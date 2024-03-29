import * as THREE from 'three';

const CURRENTPATH = '/media/giangnguyen/Storage/Multiverse-View';
const USDPATH = '/assets/ApartmentECAI';

function createCube(transform) {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    geometry.applyMatrix4(transform);

    return geometry;
}

function createGeom(transform, vertices, uvs) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geometry.applyMatrix4(transform);

    return geometry;
}

function createTexture(textureFile, anisotropy = 1, colorSpace = THREE.SRGBColorSpace, wrapS = THREE.ClampToEdgeWrapping, wrapT = THREE.ClampToEdgeWrapping) {
    if (textureFile.startsWith(`${CURRENTPATH}/public`)) {
        textureFile = textureFile.slice(`${CURRENTPATH}/public`.length);
    }
    if (!textureFile.startsWith('/')) {
        if (textureFile.startsWith('.'))
        {
            textureFile = textureFile.slice(1);
        }
        textureFile = `${USDPATH}/${textureFile}`;
    }
    console.log(`Load texture from ${textureFile}`)
    let texture = new THREE.TextureLoader().load(textureFile);
    texture.anisotropy = anisotropy;
    texture.wrapS = wrapS;
    texture.wrapT = wrapT;
    texture.colorSpace = colorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.mapping = THREE.UVMapping;
    return texture;
}

function createColor(r, g, b) {
    return new THREE.Color(r, g, b);
}

function createMaterial(color, opacity, texture = null, visible = true) {
    if (typeof opacity === 'number') {
        const transparent = opacity < 1.0;
        return new THREE.MeshStandardMaterial({
            color: color,
            opacity: opacity,
            map: texture,
            transparent: transparent,
            visible: visible
        });
    } else if (typeof opacity === 'object') {
        return new THREE.MeshStandardMaterial({
            color: color,
            alphaMap: opacity,
            map: texture,
            transparent: false,
            visible: visible,
        });
    }
}

function createMesh(name, geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    return mesh;
}

function createMaterialAndUvsFromPrim(prim) {
    console.log(`Load material from ${prim.GetTypeName()}: ${prim.GetName()}`);
    const defaultColor = createColor(0.9, 0.9, 0.9);
    const defaultOpacity = 1.0;

    let uvs = null;
    let color = defaultColor;
    let opacity = defaultOpacity;
    let texture = null;
    let visible = true;

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
            let anisotropy = 1;

            const surface = materialPrim.GetProperty('outputs:surface');
            const surfacePath = surface.GetConnections()[0];
            const surfacePrim = prim.GetStage().GetPrimAtPath(surfacePath.GetParentPath());
            
            if (surfacePrim.HasProperty('inputs:diffuseColor')) {
                if (surfacePrim.HasProperty('inputs:anisotropy')) {
                    anisotropy = surfacePrim.GetProperty('inputs:anisotropy').Get();
                }
                let diffuseColor = surfacePrim.GetProperty('inputs:diffuseColor');
                if (diffuseColor.Get()) {
                    diffuseColor = diffuseColor.Get();
                    color = createColor(diffuseColor.x, diffuseColor.y, diffuseColor.z);
                } else {
                    const diffuseColorPath = diffuseColor.GetConnections()[0];
                    const diffuseColorPrim = prim.GetStage().GetPrimAtPath(diffuseColorPath.GetParentPath());
                    if (diffuseColorPrim.HasProperty('inputs:file')) {
                        const inputsFile = diffuseColorPrim.GetProperty('inputs:file').Get();
                        
                        let colorSpace = THREE.SRGBColorSpace;
                        let wrapS = THREE.ClampToEdgeWrapping;
                        let wrapT = THREE.ClampToEdgeWrapping;
                        
                        if (diffuseColorPrim.HasProperty('inputs:sourceColorSpace')) {
                            const sourceColorSpace = diffuseColorPrim.GetProperty('inputs:sourceColorSpace').Get();
                            switch (sourceColorSpace) {
                                case 'sRGB':
                                    colorSpace = THREE.SRGBColorSpace;
                                    break;
                                
                                case 'raw':
                                    colorSpace = THREE.NoColorSpace;
                                    break;
                                
                                default:
                                    console.error('Unsupported color space:', sourceColorSpace);
                                    break;
                            }
                        }
                        if (diffuseColorPrim.HasProperty('inputs:wrapS')) {
                            wrapS = diffuseColorPrim.GetProperty('inputs:wrapS').Get() === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
                        }
                        if (diffuseColorPrim.HasProperty('inputs:wrapT')) {
                            wrapT = diffuseColorPrim.GetProperty('inputs:wrapT').Get() === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
                        }
                        texture = createTexture(inputsFile, anisotropy, colorSpace, wrapS, wrapT);
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
                            let propertyName = null;
                            if (inputsVarname.Get()) {
                                propertyName = 'primvars:' + inputsVarname.Get();
                            } else {
                                const inputsVarnamePath = inputsVarname.GetConnections()[0];
                                const inputsVarnamePrim = prim.GetStage().GetPrimAtPath(inputsVarnamePath.GetParentPath());
                                propertyName = 'primvars:' + inputsVarnamePrim.GetProperty(inputsVarnamePath.name).Get();
                            }
                            if (prim.GetTypeName() === 'Mesh' && prim.HasProperty(propertyName)) {
                                sts = prim.GetProperty(propertyName).Get();
                            } else if (prim.GetTypeName() === 'GeomSubset' && prim.GetParent().HasProperty(propertyName)) {
                                sts = prim.GetParent().GetProperty(propertyName).Get();
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
                opacity = surfacePrim.GetProperty('inputs:opacity');
                if (opacity.Get()) {
                    opacity = opacity.Get();
                } else {
                    const opacityPath = opacity.GetConnections()[0];
                    const opacityPrim = prim.GetStage().GetPrimAtPath(opacityPath.GetParentPath());
                    if (opacityPrim.HasProperty('inputs:file')) {
                        const inputsFile = opacityPrim.GetProperty('inputs:file').Get();

                        let colorSpace = THREE.SRGBColorSpace;
                        let wrapS = THREE.ClampToEdgeWrapping;
                        let wrapT = THREE.ClampToEdgeWrapping;
                        
                        if (opacityPrim.HasProperty('inputs:sourceColorSpace')) {
                            const sourceColorSpace = opacityPrim.GetProperty('inputs:sourceColorSpace').Get();
                            switch (sourceColorSpace) {
                                case 'sRGB':
                                    colorSpace = THREE.SRGBColorSpace;
                                    break;
                                
                                case 'raw':
                                    colorSpace = THREE.NoColorSpace;
                                    break;
                                
                                default:
                                    console.error('Unsupported color space:', sourceColorSpace);
                                    break;
                            }
                        }
                        if (opacityPrim.HasProperty('inputs:wrapS')) {
                            wrapS = opacityPrim.GetProperty('inputs:wrapS').Get() === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
                        }
                        if (opacityPrim.HasProperty('inputs:wrapT')) {
                            wrapT = opacityPrim.GetProperty('inputs:wrapT').Get() === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
                        }

                        opacity = createTexture(inputsFile, anisotropy, colorSpace, wrapS, wrapT);
                        opacity.format = THREE.AlphaFormat;
                    }
                }
            }
        }
    }
    if (prim.HasProperty('visibility')) {
        visible = prim.GetProperty('visibility').Get() === 'invisible' ? false : true;
    }

    const material = createMaterial(color, opacity, texture, visible);

    return {
        material: material,
        uvs: uvs
    };
}

export function getObject3DFromXform(prim, parentTransform = new THREE.Matrix4()) {
    let object3D = new THREE.Object3D();
    prim.object3D = object3D;
    object3D.name = prim.GetName();
    object3D.applyMatrix4(parentTransform);

    if (['Xform', 'Cube', 'Mesh'].includes(prim.GetTypeName())) {
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

        let geometry = null;
        
        console.log(`Load ${prim.GetTypeName()}: ${prim.GetName()}`);
        if (prim.GetTypeName() === 'Mesh' && prim.HasProperty('points') && prim.HasProperty('faceVertexIndices')) {
            const points = prim.GetProperty('points').Get();
            const faceVertexIndices = prim.GetProperty('faceVertexIndices').Get();

            const childGeomSubsetPrims = prim.GetChildren().filter(child => child.GetTypeName() === 'GeomSubset');
            if (childGeomSubsetPrims.length > 0) {
                for (let childPrim of childGeomSubsetPrims) {
                    if (childPrim.HasProperty('indices')) {
                        let { material, uvs } = createMaterialAndUvsFromPrim(childPrim);
                        if (uvs && points.length === uvs.length / 2) {
                            const uvsNew = new Float32Array(faceVertexIndices.length * 2);
                            for (let i = 0; i < faceVertexIndices.length; i += 1) {
                                const faceVertexIndex = faceVertexIndices[i];
                                uvsNew[i * 2] = uvs[faceVertexIndex * 2];
                                uvsNew[i * 2 + 1] = uvs[faceVertexIndex * 2 + 1];
                            }
                            uvs = uvsNew;
                        }
                        
                        const indices = childPrim.GetProperty('indices').Get();
                        const vertices = new Float32Array(indices.length * 9);
                        const childUvs = new Float32Array(indices.length * 6);

                        for (let i = 0; i < indices.length; i += 1) {
                            const faceIndex = indices[i];
                            const vertex1Index = faceVertexIndices[faceIndex * 3];
                            const vertex2Index = faceVertexIndices[faceIndex * 3 + 1];
                            const vertex3Index = faceVertexIndices[faceIndex * 3 + 2];

                            vertices[i * 9] = points[vertex1Index].x;
                            vertices[i * 9 + 1] = points[vertex1Index].y;
                            vertices[i * 9 + 2] = points[vertex1Index].z;
                            vertices[i * 9 + 3] = points[vertex2Index].x;
                            vertices[i * 9 + 4] = points[vertex2Index].y;
                            vertices[i * 9 + 5] = points[vertex2Index].z;
                            vertices[i * 9 + 6] = points[vertex3Index].x;
                            vertices[i * 9 + 7] = points[vertex3Index].y;
                            vertices[i * 9 + 8] = points[vertex3Index].z;
                            
                            if (uvs) {
                                childUvs[i * 6] = uvs[vertex1Index * 2];
                                childUvs[i * 6 + 1] = uvs[vertex1Index * 2 + 1];
                                childUvs[i * 6 + 2] = uvs[vertex2Index * 2];
                                childUvs[i * 6 + 3] = uvs[vertex2Index * 2 + 1];
                                childUvs[i * 6 + 4] = uvs[vertex3Index * 2];
                                childUvs[i * 6 + 5] = uvs[vertex3Index * 2 + 1];
                            }
                        }
                        geometry = createGeom(primTransform, vertices, childUvs);
                        object3D.add(createMesh(childPrim.GetName(), geometry, material));
                    }
                }
            } else {
                let vertices = new Float32Array(faceVertexIndices.length * 3);
                for (let i = 0; i < faceVertexIndices.length; i += 1) {
                    const faceVertexIndex = faceVertexIndices[i];
                    vertices[i * 3] = points[faceVertexIndex].x;
                    vertices[i * 3 + 1] = points[faceVertexIndex].y;
                    vertices[i * 3 + 2] = points[faceVertexIndex].z;
                }
                let { material, uvs } = createMaterialAndUvsFromPrim(prim);
                if (uvs && points.length === uvs.length / 2) {
                    const uvsNew = new Float32Array(faceVertexIndices.length * 2);
                    for (let i = 0; i < faceVertexIndices.length; i += 1) {
                        const faceVertexIndex = faceVertexIndices[i];
                        uvsNew[i * 2] = uvs[faceVertexIndex * 2];
                        uvsNew[i * 2 + 1] = uvs[faceVertexIndex * 2 + 1];
                    }
                    uvs = uvsNew;
                }
                geometry = createGeom(primTransform, vertices, uvs);
                object3D.add(createMesh(prim.GetName(), geometry, material));
            }
        } else if (prim.GetTypeName() === 'Cube') {
            geometry = createCube(primTransform);
            const material = createMaterialAndUvsFromPrim(prim).material;
            object3D.add(createMesh(prim.GetName(), geometry, material));
        } else if (prim.GetTypeName() === 'Xform') {
            for (let childPrim of prim.GetChildren()) {
                object3D.add(getObject3DFromXform(childPrim, primTransform));
            }
        } else {
            console.error('Unsupported type:', prim.GetTypeName());
        }
    }
    return object3D;
}