import * as THREE from 'three';

const currentPath = '/media/giangnguyen/Storage/Multiverse-View';

function createGeom(transform, vertices, uvs) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    for (let i = 0; i < vertices.length; i += 3) {
        if (vertices[i] < -1 || vertices[i + 1] < -1 || vertices[i + 2] < -1) {
            console.log('Negative vertices found');
            console.log(vertices[i], vertices[i + 1], vertices[i + 2]);
        }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));

    geometry.applyMatrix4(transform);

    return geometry;
}

function createTexture(textureFile) {
    if (textureFile.startsWith(`${currentPath}/public`)) {
        textureFile = textureFile.slice(`${currentPath}/public`.length);
    }
    return new THREE.TextureLoader().load(textureFile);
}

function createColor(r, g, b) {
    return new THREE.Color(r, g, b);
}

function createMaterial(color, opacity, texture = null) {
    const transparent = opacity < 1.0;
    return new THREE.MeshStandardMaterial({
        color: color,
        opacity: opacity,
        map: texture,
        transparent: transparent,
    });
}

function createMesh(geometry, material) {
    return new THREE.Mesh(geometry, material)
}

const defaultColor = createColor(0.0, 1.0, 0.0);
const defaultOpacity = 1.0;

export function getObject3DFromXform(prim, parentTransform = new THREE.Matrix4()) {
    let object3D = new THREE.Object3D();
    prim.object3D = object3D;
    object3D.name = prim.GetName();
    object3D.applyMatrix4(parentTransform);

    if (['Xform', 'Mesh'].includes(prim.GetTypeName())) {
        let primTransform = parentTransform;

        if (prim.HasProperty('xformOpOrder')) {
            const xformOpOrder = prim.GetProperty('xformOpOrder').Get();
            for (let xformOp of xformOpOrder) {
                if (xformOp === 'xformOp:transform') {
                    let xformOpTransform = prim.GetProperty(xformOp).Get();
                    if (xformOpTransform === null) {
                        xformOpTransform = new THREE.Matrix4();
                    }
                    primTransform = xformOpTransform;
                } else {
                    console.error('Unsupported xformOp:', xformOp);
                }
            }
        }
        
        if (prim.GetTypeName() === 'Mesh') {
            // Get the vertices
            const points = prim.GetProperty('points').Get();
            const faceVertexIndices = prim.GetProperty('faceVertexIndices').Get();
            const vertices = new Float32Array(faceVertexIndices.length * 3);
            for (let i = 0; i < faceVertexIndices.length; i += 1) {
                const faceVertexIndex = faceVertexIndices[i];
                vertices[i * 3] = points[faceVertexIndex].x;
                vertices[i * 3 + 1] = points[faceVertexIndex].y;
                vertices[i * 3 + 2] = points[faceVertexIndex].z;
            }

            let uvs = new Float32Array(0);
            
            // Get the color and opacity
            let color = defaultColor;
            let opacity = defaultOpacity;
            let texture = null;

            if (prim.HasProperty('primvars:displayColor')) {
                const displayColor = prim.GetProperty('primvars:displayColor').Get();
                color = createColor(displayColor[0].x, displayColor[0].y, displayColor[0].z);
            }
            if (prim.HasProperty('primvars:displayOpacity')) {
                opacity = prim.GetProperty('primvars:displayOpacity').Get()[0];
            }
            if (prim.HasProperty('material:binding'))
            {
                const materialBinding = prim.GetProperty('material:binding').GetTargets();
                const materialPath = materialBinding[0];
                const materialPrim = prim.GetStage().GetPrimAtPath(materialPath);

                if (materialPrim.HasProperty('outputs:surface')) {
                    const surface = materialPrim.GetProperty('outputs:surface');
                    const surfacePath = surface.GetConnections()[0];
                    const surfacePrim = prim.GetStage().GetPrimAtPath(surfacePath.GetParentPath());
                    
                    if (surfacePrim.HasProperty('inputs:diffuseColor')) {
                        let diffuseColor = surfacePrim.GetProperty('inputs:diffuseColor');
                        if (diffuseColor.Get()) {
                            diffuseColor = diffuseColor.Get();
                            color = createColor(diffuseColor.x, diffuseColor.y, diffuseColor.z);
                        } else {
                            const diffuseColorPath = diffuseColor.GetConnections()[0];
                            const diffuseColorPrim = prim.GetStage().GetPrimAtPath(diffuseColorPath.GetParentPath());
                            if (diffuseColorPrim.HasProperty('inputs:file')) {
                                const inputsFile = diffuseColorPrim.GetProperty('inputs:file').Get();
                                texture = createTexture(inputsFile);
                            }

                            if (diffuseColorPrim.HasProperty('inputs:st')) {
                                const inputsSt = diffuseColorPrim.GetProperty('inputs:st');
                                let sts = null;
                                if (inputsSt.Get()) {
                                    sts = inputsSt.Get();
                                } else {
                                    const inputsStPath = inputsSt.GetConnections()[0];
                                    const inputsStPrim = prim.GetStage().GetPrimAtPath(inputsStPath.GetParentPath());
                                    const inputsVarname = inputsStPrim.GetProperty('inputs:varname');
                                    const inputsVarnamePath = inputsVarname.GetConnections()[0];
                                    const inputsVarnamePrim = prim.GetStage().GetPrimAtPath(inputsVarnamePath.GetParentPath());
                                    const propertyName = 'primvars:' + inputsVarnamePrim.GetProperty(inputsVarnamePath.name).Get();
                                    if (prim.HasProperty(propertyName)) {
                                        sts = prim.GetProperty(propertyName).Get();
                                    }
                                }
                                if (sts) {
                                    uvs = new Float32Array(sts.length * 2);
                                    for (let i = 0; i < sts.length; i += 1) {
                                        uvs[i * 2] = sts[i].x;
                                        uvs[i * 2 + 1] = sts[i].y;
                                    }
                                }
                            }
                        }
                    }

                    if (surfacePrim.HasProperty('inputs:opacity')) {
                        opacity = surfacePrim.GetProperty('inputs:opacity').Get();
                    }
                }
            }

            const material = createMaterial(color, opacity, texture);
            const geometry = createGeom(primTransform, vertices, uvs);
            object3D.add(createMesh(geometry, material));

        } else if (prim.GetTypeName() === 'Xform') {
            for (let childPrim of prim.GetChildren()) {
                object3D.add(getObject3DFromXform(childPrim, primTransform));
            }
        }
    }
    return object3D;
}