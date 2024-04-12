import * as dat from 'dat.gui';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let gui = new dat.GUI({ 'width': 500 });

var params = {};

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
    if (!prim.HasProperty('semanticTag:semanticLabel')) {
        return null;
    }

    const p = document.createElement('p');
    p.style.color = 'yellow';
    p.textContent = '[';

    for (let relationship of prim.GetProperty('semanticTag:semanticLabel').GetTargets()) {
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
    
    return cPointLabel;
}

function resetAnnotator(scene, prim, params){
    const primPath = prim.GetPath().pathString;
    scene.remove(params[primPath]['annotator']);
    params[primPath]['annotator'] = annotatePrimWithSemanticLabels(prim);
    if (params[primPath]['annotator'] !== null) {
        scene.add(params[primPath]['annotator']);
    }
}

export function createGuiFromStage(scene, stage) {
    const hightlightColor = new THREE.Color(0xffff00);

    params = {};
    if (gui) {
        gui.destroy();
        gui = null; // Remove reference to the old GUI
    }
    gui = new dat.GUI({ 'width': 500 });

    const objectsFolder = gui.addFolder('Objects');
    const ontologyList = ["DUL", "SOMA"];
    const ontologies = {};
    for (let ontology of ontologyList) {
        ontologies[ontology] = {};
        ontologies[ontology][""] = null;
        const ontoPrim = stage.GetPrimAtPath('/' + ontology);
        for (let classPrim of ontoPrim.GetAllChildren()) {
            if (classPrim.HasProperty('rdf:conceptName') && classPrim.HasProperty('rdf:namespace')) {
                const rdfNamespace = classPrim.GetProperty('rdf:namespace').Get();
                const rdfConceptName = classPrim.GetProperty('rdf:conceptName').Get();
                const rdfClassName = rdfNamespace + rdfConceptName;
                ontologies[ontology][rdfConceptName] = rdfClassName;
            }
        }

        // Get the keys and sort them alphabetically
        var sortedKeys = Object.keys(ontologies[ontology]).sort();

        // Create a new object with sorted keys
        var sortedDictionary = {};
        sortedKeys.forEach(function (key) {
            sortedDictionary[key] = ontologies[ontology][key];
        });

        ontologies[ontology] = sortedDictionary;
    }

    for (let prim of stage.Traverse()) {
        const primPath = prim.GetPath().pathString;
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

            params[primPath]["show"] = primObject3D.visible;
            primFolder.add(params[primPath], "show").name("show").onChange(function (value) {
                primObject3D.visible = value;
            });

            params[primPath]["children"] = [];
            for (let childPrim of prim.GetAllChildren()) {
                const childPrimPath = childPrim.GetPath().pathString;
                if (['Cube', 'Mesh'].includes(childPrim.GetTypeName())) {
                    if (childPrim.object3D === undefined ||
                        childPrim.object3D.children.length === 0 ||
                        childPrim.object3D.children[0].material === undefined) {
                        continue;
                    }
                    params[primPath]["children"].push(childPrimPath);
                }
            }

            params[primPath]["highlight"] = false;
            primFolder.add(params[primPath], "highlight").name("highlight").onChange(function (value) {
                for (let childPrimPath of params[primPath]["children"]) {
                    const childPrim = stage.GetPrimAtPath(childPrimPath);
                    for (let childPrimObject3D of childPrim.object3D.children) {
                        const childPrimObject3DName = childPrimObject3D.name;
                        childPrimObject3D.material.color = value ? hightlightColor : params[childPrimPath]["color"][childPrimObject3DName];
                    }
                }
            });

            params[primPath]['semanticLabels'] = {};
            const ontoFolders = primFolder.addFolder('semantic labels');
            for (let ontology of ontologyList) {
                ontoFolders.add(ontologies, ontology, ontologies[ontology]).name(ontology).onChange(function (value) {
                    if (value === undefined || value === 'null') {
                        return;
                    }
                    params[primPath]['semanticLabels'][ontology] = value;
                });
            }

            params[primPath]['annotator'] = null;

            resetAnnotator(scene, prim, params);

            // Create an object to hold the button actions
            var buttonActions = {
                addButton: function () {
                    const prim = stage.GetPrimAtPath(primPath);
                    const relationships = prim.CreateRelationship('semanticTag:semanticLabel');
                    for (let ontology of ontologyList) {
                        const value = params[primPath]['semanticLabels'][ontology];
                        if (value === undefined || value === 'null') {
                            continue;
                        }

                        relationships.AddTarget('/' + ontology + '/_class_' + value.split('#').pop());
                    }
                    logPrimSemanticLabels(stage, primPath, relationships);
                    resetAnnotator(scene, prim, params);
                },
                removeButton: function () {
                    const prim = stage.GetPrimAtPath(primPath);
                    if (!prim.HasProperty('semanticTag:semanticLabel')) {
                        return;
                    }

                    const relationships = prim.GetProperty('semanticTag:semanticLabel');
                    for (let ontology of ontologyList) {
                        const value = params[primPath]['semanticLabels'][ontology];
                        if (value === undefined || value === 'null') {
                            continue;
                        }
                        if (relationships.RemoveTarget('/' + ontology + '/_class_' + value.split('#').pop())) {
                            console.log(`Removed class ${value} from prim ${primPath}`)
                        }
                    }
                    logPrimSemanticLabels(stage, primPath, relationships);
                    resetAnnotator(scene, prim, params);
                }
            };

            // Add buttons to GUI
            ontoFolders.add(buttonActions, 'addButton').name('Add');
            ontoFolders.add(buttonActions, 'removeButton').name('Remove');
        }
    }

    objectsFolder.open();
    gui.open();
}