import * as dat from 'dat.gui';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let gui = new dat.GUI({ 'width': 500 });

var menus = {};

var params = {};

var ontologyList = new Set();

function logPrimSemanticLabels(stage, primPath, relationships) {
    console.log(`Set classes of prim ${primPath} to:`);
    for (let ontoPath of relationships.GetTargets()) {
        const ontoPrim = stage.GetPrimAtPath(ontoPath);
        if (!ontoPrim.HasProperty('rdf:conceptName') || !ontoPrim.HasProperty('rdf:namespace')) {
            continue;
        }
        const rdfClassName = ontoPrim.GetProperty('rdf:namespace').Get() + ontoPrim.GetProperty('rdf:conceptName').Get();
        console.log(rdfClassName);
    }
}

function annotatePrimWithSemanticLabels(prim) {
    if (!prim.HasProperty('semanticTag:semanticLabels') || prim.GetProperty('semanticTag:semanticLabels').GetTargets().length == 0) {
        return null;
    }

    const p = document.createElement('p');
    p.style.color = 'lime';
    p.textContent = '[';

    for (let relationship of prim.GetProperty('semanticTag:semanticLabels').GetTargets()) {
        const ontoPrim = prim.GetStage().GetPrimAtPath(relationship);
        if (!ontoPrim.HasProperty('rdf:conceptName') || !ontoPrim.HasProperty('rdf:namespace')) {
            continue;
        }
        p.textContent += ontoPrim.GetParent().GetName() + ':' + ontoPrim.GetProperty('rdf:conceptName').Get() + ', ';
    }

    p.textContent = p.textContent.slice(0, -2);
    p.textContent += ']';

    const cPointLabel = new CSS2DObject(p);
    const primTransform = prim.HasProperty('xformOp:transform') ? prim.GetProperty('xformOp:transform').Get() : new THREE.Matrix4();
    var position = new THREE.Vector3();
    var quaternion = new THREE.Quaternion();
    var scale = new THREE.Vector3();
    primTransform.decompose(position, quaternion, scale);
    cPointLabel.position.set(position.x, position.y, position.z);

    var parentPrim = prim.GetParent();
    while (parentPrim.GetPath().pathString !== '/') {
        const parenPrimTransform = parentPrim.HasProperty('xformOp:transform') ? parentPrim.GetProperty('xformOp:transform').Get() : new THREE.Matrix4();
        cPointLabel.position.applyMatrix4(parenPrimTransform);
        parentPrim = parentPrim.GetParent();
    }

    return cPointLabel;
}

function resetAnnotator(scene, prim, ontoFolders) {
    const primPath = prim.GetPath().pathString;
    scene.remove(params[primPath]['annotator']);
    if (menus[primPath]['semanticLabelsButton'] !== undefined) {
        ontoFolders.remove(menus[primPath]['semanticLabelsButton']);
    }
    params[primPath]['annotator'] = annotatePrimWithSemanticLabels(prim);

    if (params[primPath]['annotator'] !== null) {
        scene.add(params[primPath]['annotator']);
        params[primPath]['semanticLabels'] = params[primPath]['annotator'].element.textContent;
        menus[primPath]['semanticLabelsButton'] = ontoFolders.add(params[primPath], 'semanticLabels').name('Semantic labels').listen();
        var color = 'lime';
    } else {
        menus[primPath]['semanticLabelsButton'] = undefined;
        var color = 'yellow';
    }

    const elements = document.querySelectorAll('.dg .folder');
    elements.forEach(element => {
        for (let childDivNodes of element.childNodes) {
            for (let childUlNode of childDivNodes.childNodes) {
                for (let childLiNode of childUlNode.childNodes) {
                    if(childLiNode.textContent == prim.GetPath().pathString) {
                        element.style.backgroundColor = color;
                        childLiNode.style.color = color;
                        return;
                    }
                }
            }
        }
    });
}

export function createGuiFromStage(scene, stage) {
    const hightlightColor = new THREE.Color(0xffff00);

    menus = {};
    params = {};

    if (gui) {
        gui.destroy();
        gui = null; // Remove reference to the old GUI
    }
    gui = new dat.GUI({ 'width': 500 });

    const objectsFolder = gui.addFolder('Objects');

    for (let prim of stage.Traverse()) {
        const primPath = prim.GetPath().pathString;
        menus[primPath] = {};
        params[primPath] = {};

        if (['Cube', 'Mesh'].includes(prim.GetTypeName())) {
            if (prim.object3D === undefined) {
                console.log(`object3D of ${prim.GetName()} is undefined`);
                continue;
            }

            params[primPath]["color"] = {};

            for (let childPrimObject3D of prim.object3D.children) {
                const childPrimObject3DName = childPrimObject3D.name;
                if (childPrimObject3D.material === undefined) {
                    console.log(`Material of ${childPrimObject3DName} is undefined`);
                    continue;
                }

                params[primPath]["color"][childPrimObject3DName] = childPrimObject3D.material.color;
            }
        }

        if (prim.GetTypeName() === 'Xform') {
            const primObject3D = prim.object3D;

            const primFolder = objectsFolder.addFolder(primPath);

            menus[primPath]["show"] = primObject3D.visible;
            primFolder.add(menus[primPath], "show").name("show").onChange(function (value) {
                primObject3D.visible = value;
            });

            menus[primPath]["children"] = [];
            for (let childPrim of prim.GetAllChildren()) {
                const childPrimPath = childPrim.GetPath().pathString;
                if (['Cube', 'Mesh'].includes(childPrim.GetTypeName())) {
                    if (childPrim.object3D === undefined ||
                        childPrim.object3D.children.length === 0 ||
                        childPrim.object3D.children[0].material === undefined) {
                        continue;
                    }
                    menus[primPath]["children"].push(childPrimPath);
                }
            }

            menus[primPath]["highlight"] = false;
            primFolder.add(menus[primPath], "highlight").name("highlight").onChange(function (value) {
                for (let childPrimPath of menus[primPath]["children"]) {
                    const childPrim = stage.GetPrimAtPath(childPrimPath);
                    for (let childPrimObject3D of childPrim.object3D.children) {
                        const childPrimObject3DName = childPrimObject3D.name;
                        childPrimObject3D.material.color = value ? hightlightColor : params[childPrimPath]["color"][childPrimObject3DName];
                    }
                }
            });

            menus[primPath]['semanticReports'] = {};

            const ontoFolders = primFolder.addFolder('Semantic tagging');

            if (!prim.HasProperty('semanticTag:semanticReports')) {
                continue;
            }

            for (let relationship of prim.GetProperty('semanticTag:semanticReports').GetTargets()) {
                const ontoPrim = prim.GetStage().GetPrimAtPath(relationship);
                if (!ontoPrim.HasProperty('rdf:conceptName') || !ontoPrim.HasProperty('rdf:namespace')) {
                    continue;
                }
                const ontology = ontoPrim.GetParent().GetName();
                ontologyList.add(ontology);
                if (!(ontology in menus[primPath]['semanticReports'])) {
                    menus[primPath]['semanticReports'][ontology] = {};
                    menus[primPath]['semanticReports'][ontology][""] = null;
                }
                menus[primPath]['semanticReports'][ontology][ontoPrim.GetProperty('rdf:conceptName').Get()] = ontoPrim.GetProperty('rdf:conceptName').Get();
            }

            menus[primPath]['semanticLabels'] = {};

            for (let ontology in menus[primPath]['semanticReports']) {
                ontoFolders.add(menus[primPath]['semanticReports'], ontology, menus[primPath]['semanticReports'][ontology]).name(ontology).onChange(function (value) {
                    if (value === undefined || value === 'null') {
                        return;
                    }
                    menus[primPath]['semanticLabels'][ontology] = value;
                });
            }

            params[primPath]['annotator'] = null;

            resetAnnotator(scene, prim, ontoFolders);

            // Create an object to hold the button actions
            var buttonActions = {
                addButton: function () {
                    const prim = stage.GetPrimAtPath(primPath);
                    const relationships = prim.CreateRelationship('semanticTag:semanticLabels');
                    for (let ontology in menus[primPath]['semanticLabels']) {
                        const value = menus[primPath]['semanticLabels'][ontology];
                        if (value === undefined || value === 'null') {
                            continue;
                        }
                        relationships.AddTarget('/' + ontology + '/_class_' + value.replace(/\./g, '').split('#').pop());
                    }
                    logPrimSemanticLabels(stage, primPath, relationships);
                    resetAnnotator(scene, prim, ontoFolders);
                },
                removeButton: function () {
                    const prim = stage.GetPrimAtPath(primPath);
                    if (!prim.HasProperty('semanticTag:semanticLabels')) {
                        return;
                    }

                    const relationships = prim.GetProperty('semanticTag:semanticLabels');
                    for (let ontology in menus[primPath]['semanticLabels']) {
                        const value = menus[primPath]['semanticLabels'][ontology];
                        if (value === undefined || value === 'null') {
                            continue;
                        }
                        if (relationships.RemoveTarget('/' + ontology + '/_class_' + value.replace(/\./g, '').split('#').pop())) {
                            console.log(`Removed class ${value} from prim ${primPath}`)
                        }
                    }
                    logPrimSemanticLabels(stage, primPath, relationships);
                    resetAnnotator(scene, prim, ontoFolders);
                }
            };

            // Add buttons to GUI
            ontoFolders.add(buttonActions, 'addButton').name('Add');
            ontoFolders.add(buttonActions, 'removeButton').name('Remove');
        }
    }

    objectsFolder.open();
    gui.open();

    const elements = document.querySelectorAll('.c');
    elements.forEach(element => {
        const ontology = element.previousSibling.textContent;
        if (ontologyList.has(ontology)) {
            for (let childNode of element.childNodes) {
                if (childNode.nodeName === 'SELECT') {
                    for (let option of childNode.options) {
                        if (option.value === 'null') {
                            continue;
                        }
                        const ontologyPath = '/' + ontology + '/_class_' + option.value.replace(/\./g, '');
                        const ontologyPrim = stage.GetPrimAtPath(ontologyPath);
                        if (!ontologyPrim.HasProperty('rdf:definition')) {
                            continue;
                        }
                        option.setAttribute('title', ontologyPrim.GetProperty('rdf:definition').Get());
                    }
                }
            }
        }
    });
}