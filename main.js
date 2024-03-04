import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';
import WebGL from 'three/addons/capabilities/WebGL.js';

// Create a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a scene
const scene = new THREE.Scene();

// Create a GUI
const gui = new dat.GUI();

// Create a camera
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.up.set(0, 0, 1);
camera.position.set(0.15, 0.15, 0.2);
camera.lookAt(0, 0, 0);

// Create an orbit control
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.update();

// Create a grid helper
const gridHelper = new THREE.GridHelper(10, 10);
gridHelper.rotateX(-Math.PI / 2);
scene.add(gridHelper);

// Create an axes helper
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

////////////////
// USD loader //
////////////////

// Create a mesh
function getParentDirectory(filePath) {
    // Split the filePath by '/' to get segments and remove the last segment (the file name)
    const segments = filePath.split('/');
    segments.pop(); // Remove the last segment

    // Join the segments back to get the parent directory path
    return segments.join('/') + '/';
}

function createGeom(vertices, uvs) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    for (let i = 0; i < vertices.length; i += 3) {
        if (vertices[i] < -1 || vertices[i + 1] < -1 || vertices[i + 2] < -1) {
            console.log('Negative vertices found');
            console.log(vertices[i], vertices[i + 1], vertices[i + 2]);
        }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    return geometry;
}

function createMesh(geometry, material) {
    return new THREE.Mesh(geometry, material)
}

function getMeshData(usdContent, primName) {
    // Function to parse the USD content and find the relevant data based on primName
    let lines = usdContent.split('\n');
    let insidePrim = false;
    let pointsData = [];
    let verticesData = [];
    let faceVertexIndices = [];
    let primvarsStData = [];

    lines.forEach(line => {
        if (line.includes(`def Mesh "${primName}"`)) {
            insidePrim = true;
        } else if (insidePrim && line.trim() === "}") {
            insidePrim = false;
        }

        if (insidePrim) {
            if (line.trim().startsWith("point3f[] points = [")) {
                let pointsString = line.slice(line.indexOf('[') + 1, line.lastIndexOf(']'));
                pointsData = pointsString.match(/-?\d*\.?\d+(e-?\d+)?/g).map(parseFloat);
            }
            else if (line.trim().startsWith("int[] faceVertexIndices = [")) {
                let indicesString = line.slice(line.indexOf('[') + 1, line.lastIndexOf(']'));
                faceVertexIndices = indicesString.match(/[\d]+/g).map(Number);
            }
            else if (line.trim().startsWith("texCoord2f[] primvars:UVMap = [") ||
                line.trim().startsWith("texCoord2f[] primvars:st = [")) {
                let primvarsStString = line.slice(line.indexOf('[') + 1, line.lastIndexOf(']'));
                primvarsStData = primvarsStString.match(/-?\d*\.?\d+(e-?\d+)?/g).map(parseFloat);
            }
        }
    });

    for (let i = 0; i < faceVertexIndices.length; i += 1) {
        let faceVertexIndex = faceVertexIndices[i];
        verticesData.push(pointsData[3 * faceVertexIndex], pointsData[3 * faceVertexIndex + 1], pointsData[3 * faceVertexIndex + 2]);
    }

    // Convert the vertices data to Float32Array
    const verticesFloat32Array = new Float32Array(verticesData);

    // Convert the primvarsStData to Float32Array
    const primvarsStFloat32Array = new Float32Array(primvarsStData);

    // Return the vertices and primvarsSt
    return {
        vertices: verticesFloat32Array,
        primvarsSt: primvarsStFloat32Array
    };
}

function getShaderInfoId(shaderContent) {
    let lines = shaderContent.split('\n');

    let infoId = null;
    lines.forEach(line => {
        if (line.trim().startsWith("uniform token info:id = \"")) {
            infoId = line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'));
        }
    });

    return infoId;
}

function getPBRShaderData(PBRShaderContent, materialName) {
    let lines = PBRShaderContent.split('\n');

    let pbrShaderData = {
        diffuseColor: defaultDiffuseColor,
        emissiveColor: [0.0, 0.0, 0.0],
        opacity: 1.0,
    };

    lines.forEach(line => {
        if (line.trim().startsWith("color3f inputs:diffuseColor = (")) {
            let diffuseColorString = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
            pbrShaderData.diffuseColor = diffuseColorString.match(/-?\d*\.?\d+(e-?\d+)?/g).map(parseFloat);
        }
        else if (line.trim().startsWith(`color3f inputs:diffuseColor.connect = </${materialName}/`)) {
            pbrShaderData.diffuseColor = line.slice(line.indexOf('<') + 1, line.lastIndexOf('>'));
        }
        else if (line.trim().startsWith("color3f inputs:emissiveColor = (")) {
            let emissiveColorString = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
            pbrShaderData.emissiveColor = emissiveColorString.match(/-?\d*\.?\d+(e-?\d+)?/g).map(parseFloat);
        }
        else if (line.trim().startsWith("float inputs:opacity = ")) {
            pbrShaderData.opacity = parseFloat(line.split('=')[1]);
        }
    });

    return pbrShaderData;
}

function getDiffuseTextureShaderData(diffuseTextureShaderContent) {
    let lines = diffuseTextureShaderContent.split('\n');

    let diffuseTextureShaderData = {
        file: null,
    };

    lines.forEach(line => {
        if (line.trim().startsWith("asset inputs:file = @")) {
            diffuseTextureShaderData.file = line.slice(line.indexOf('@') + 1, line.lastIndexOf('@'));
        }
    });

    return diffuseTextureShaderData;
}

function getMaterialData(usdContent, primName, primSdfPath) {
    const materialStartPattern = new RegExp(`def Material "${primName}"`);

    const materialData = extractPrimDataFromStartPattern(usdContent, materialStartPattern, primSdfPath);
    const materialName = materialData.primName;
    let pbrShaderData = null;
    let primvarReaderShaderData = null;
    let diffuseTextureShaderData = null;
    for (let i = 0; i < materialData.childPrimContents.length; i++) {
        const materialChildContent = materialData.childPrimContents[i];
        const shaderStartPattern = new RegExp(`def Shader`);
        const shaderData = extractPrimDataFromStartPattern(materialChildContent, shaderStartPattern, materialData.primSdfPath);

        const shaderName = shaderData.primName;
        const shaderBlock = shaderData.primBlock;
        const shaderInfoId = getShaderInfoId(shaderBlock);
        if (shaderInfoId === 'UsdPreviewSurface') {
            pbrShaderData = getPBRShaderData(shaderBlock, materialName);
        }
        else if (shaderInfoId === 'UsdPrimvarReader_float2') {
            // TODO: Implement the primvar reader shader data extraction
        }
        else if (shaderInfoId === 'UsdUVTexture') {
            diffuseTextureShaderData = getDiffuseTextureShaderData(shaderBlock);
        }
    }

    const diffuseColor = pbrShaderData.diffuseColor;
    if (typeof (diffuseColor) === 'string') {
        return {
            diffuseColor: diffuseTextureShaderData.file,
            opacity: pbrShaderData.opacity,
        };
    }
    else {
        return {
            diffuseColor: diffuseColor,
            opacity: pbrShaderData.opacity,
        };
    }
}

function getDefaultPrimName(usdContent) {
    // Match everything from '#usda 1.0' up to the first occurrence of a line not part of the header
    const headerRegex = /#usda 1.0\s*\(([^)]+)\)/s;
    const headerMatch = usdContent.match(headerRegex);
    let headerSection = '';

    if (headerMatch && headerMatch[0]) {
        headerSection = headerMatch[0];
    } else {
        // If the regex does not match, the entire content or a predefined part might be considered as the header
        console.warn('The USD content does not contain a valid header. The entire content or a predefined part might be considered as the header.');
        headerSection = usdContent;
    }

    const defaultPrimRegex = /defaultPrim\s*=\s*"([^"]+)"/;
    const defaultPrimMatch = headerSection.match(defaultPrimRegex);

    if (defaultPrimMatch && defaultPrimMatch[1]) {
        return defaultPrimMatch[1];
    } else {
        return null; // or any fallback value you'd prefer
    }
}

function extractPrimContentFromStartPattern(usdContent, primStartPattern) {
    const startIndex = usdContent.search(primStartPattern);

    if (startIndex === -1) {
        return null; // Prim block not found
    }

    let openBraces = 0;
    let endIndex = startIndex;

    // Start searching from the point where the prim block starts
    for (let i = startIndex; i < usdContent.length; i++) {
        if (usdContent[i] === '{') {
            openBraces++;
        } else if (usdContent[i] === '}') {
            openBraces--;
            if (openBraces === 0) { // Found the matching closing brace
                endIndex = i;
                break;
            }
        }
    }

    if (endIndex === startIndex) {
        return null; // Matching closing brace not found
    }

    return usdContent.substring(startIndex, endIndex + 1);
}

function extractPrimDataFromStartPattern(usdContent, primStartPattern, parentSdfPath = '') {
    const primContent = extractPrimContentFromStartPattern(usdContent, primStartPattern);
    if (primContent === null) {
        return null; // Proper content block not found
    }
    return extractPrimData(primContent, parentSdfPath);
}

function extractPrimDataFromBrace(primContent, startBrace, endBrace) {
    let braceCount = 0;
    let insidePrim = false;
    let primContentStart = -1;
    let primContentEnd = -1;

    // Start searching from the found prim block
    for (let i = 0; i < primContent.length; i++) {
        const char = primContent[i];

        if (char === startBrace) {
            braceCount++;
            if (!insidePrim) {
                insidePrim = true;
                primContentStart = i + 1; // Content starts after this brace
            }
        } else if (char === endBrace) {
            braceCount--;
        }

        if (insidePrim && braceCount === 0) {
            primContentEnd = i; // Content ends before this brace
            break;
        }
    }

    if (primContentStart === -1 || primContentEnd === -1) {
        return null; // Proper content block not found
    }

    // Extract the content block
    return primContent.substring(primContentStart, primContentEnd).trim();
}

function extractPrimHeader(primHeader) {
    let apiSchemas = [];
    const apiSchemaPattern = /prepend apiSchemas = \[([^\]]+)\]/g;
    let apiSchemaMatch;
    while ((apiSchemaMatch = apiSchemaPattern.exec(primHeader)) !== null) {
        const schemas = apiSchemaMatch[1].split(',').map(schema =>
            schema.trim().replace(/"/g, '') // Escaping double quotes
        );
        apiSchemas = apiSchemas.concat(schemas);
    }

    let references = [];
    const referencePattern = /prepend references = @([^@]+)@<\/([^>]+)>/g;
    let referenceMatch;
    while ((referenceMatch = referencePattern.exec(primHeader)) !== null) {
        references.push({ path: referenceMatch[1], name: referenceMatch[2] });
    }

    return {
        apiSchemas: apiSchemas,
        references: references,
    };
}

function extractPrimName(primContent) {
    const regex = /def\s+\w+\s+"([^"]+)"/;
    const match = primContent.match(regex);
    if (match) {
        return match[1]; // The captured group which is the prim name
    }
    return null; // Prim name not found
}

function extractPrimData(primContent, parentSdfPath) {
    let childPrimContents = [];

    const primName = extractPrimName(primContent);

    const primSdfPath = `${parentSdfPath}/${primName}`;

    let primHeader = extractPrimDataFromBrace(primContent, "(", ")");
    if (primHeader !== null) {
        primHeader = extractPrimHeader(primHeader);
    }

    let primBlock = extractPrimDataFromBrace(primContent, "{", "}");

    // Further processing to exclude child definitions like 'def Mesh', if necessary
    let childDefIndex = primBlock.search(/def\s+/);

    // TODO: Remove the child prim from the xformBlock
    if (childDefIndex !== -1) {
        let childPrimsContent = primBlock.substring(childDefIndex).trim();

        primBlock = primBlock.substring(0, childDefIndex).trim();

        while (childDefIndex !== -1) {
            const childPrimContent = extractPrimContentFromStartPattern(childPrimsContent, /def\s+/);

            childPrimContents.push(childPrimContent);

            childPrimsContent = childPrimsContent.substring(childPrimContent.length).trim();

            childDefIndex = childPrimsContent.search(/def\s+/);
        }
    }

    return {
        primSdfPath: primSdfPath,
        primName: primName,
        primHeader: primHeader,
        primBlock: primBlock,
        childPrimContents: childPrimContents
    };
}

function getXformProperties(xformContent) {
    let lines = xformContent.split('\n');
    let xformOpTransformData = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    // TODO: Check if the prim has uniform token[] xformOpOrder = ["xformOp:transform"]
    lines.forEach(line => {
        if (line.trim().startsWith("matrix4d xformOp:transform = (")) {
            let xformOpTransformString = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
            xformOpTransformData = xformOpTransformString.match(/-?\d*\.?\d+(e-?\d+)?/g).map(parseFloat);
        }
    });

    // Convert the vertices data to Float32Array
    const xformOpTransformArray = new Float32Array(xformOpTransformData);

    return {
        xformOpTransform: xformOpTransformArray,
    };
}

const meshes = {};
const geometries = {};
const materials = {};
const defaultDiffuseColor = [0.9, 0.9, 0.9];
const xform = {};

// const usdFilePath = '/assets/milk_box/milk_box.usda';
const usdFilePath = '/assets/cold_cutting_2/cold_cutting_2.usda';
const usdDirPath = getParentDirectory(usdFilePath);
const fileLoader = new THREE.FileLoader();
fileLoader.load(usdFilePath, function (usdContent) {
    const primName = getDefaultPrimName(usdContent);
    console.log('Load the prim:', primName);

    const primStartPattern = new RegExp(`def Xform "${primName}"`);
    const xformData = extractPrimDataFromStartPattern(usdContent, primStartPattern);

    const xformHeader = xformData.primHeader;
    const xformBlock = xformData.primBlock;
    const xformChildContents = xformData.childPrimContents;

    const xformProperties = getXformProperties(xformBlock);

    xform[primName] = {
        xformHeader: xformHeader,
        xformProperties: xformProperties,
        childXforms: [],
        childMeshes: [],
    };

    for (let xformChildContent of xformChildContents) {
        const meshStartPattern = new RegExp(`def Mesh`);
        const meshData = extractPrimDataFromStartPattern(xformChildContent, meshStartPattern, xformData.primSdfPath);
        
        if (meshData === null) {
            continue;
        }

        const meshHeader = meshData.primHeader;
        const meshBlock = meshData.primBlock;
        const meshChildContents = meshData.childPrimContents;

        let meshName;
        let meshPath;
        let meshSdfPath;

        if (meshHeader.references.length === 0) {
            meshName = meshData.primName;
            meshPath = usdFilePath;
            meshSdfPath = meshData.primSdfPath;
        }
        else {
            meshName = meshHeader.references[0].name;
            meshPath = meshHeader.references[0].path;
            if (!meshPath.startsWith('/')) {
                meshPath = usdDirPath + meshPath;
            }
            meshSdfPath = '';
        }

        xform[primName].childMeshes.push(
            {
                name: meshName,
                path: meshPath,
                sdfPath: meshSdfPath,
                materials: [],
            }
        );

        for (let meshChildContent of meshChildContents) {
            const scopeStartPattern = new RegExp(`def Scope`);
            const scopeData = extractPrimDataFromStartPattern(meshChildContent, scopeStartPattern);

            const scopeChildContents = scopeData.childPrimContents;
            for (let scopeChildContent of scopeChildContents) {
                const materialStartPattern = new RegExp(`def Material`);
                const materialData = extractPrimDataFromStartPattern(scopeChildContent, materialStartPattern);

                const materialHeader = materialData.primHeader;

                let materialName;
                let materialPath;
                let materialSdfPath;

                if (materialHeader.references.length === 0) {
                    materialName = materialData.primName;
                    materialPath = usdFilePath;
                    materialSdfPath = materialData.primSdfPath;
                }
                else {
                    materialName = materialHeader.references[0].name;
                    materialPath = materialHeader.references[0].path;
                    if (!materialPath.startsWith('/')) {
                        materialPath = usdDirPath + materialPath;
                    }
                    materialSdfPath = '';
                }

                xform[primName].childMeshes[xform[primName].childMeshes.length - 1].materials.push(
                    {
                        name: materialName,
                        path: materialPath,
                        sdfPath: materialSdfPath,
                    }
                );
            }
        }
    }

    for (let mesh of xform[primName].childMeshes) {
        fileLoader.load(
            mesh.path,
            function (data) {
                if (mesh.name === null) {
                    mesh.name = getDefaultPrimName(data);
                }
                if (geometries[mesh.name] === undefined) {
                    console.log('Load the mesh:', mesh.path);
                    const meshData = getMeshData(data, mesh.name);
                    geometries[mesh.name] = createGeom(meshData.vertices, meshData.primvarsSt);
                }
                const geometry = geometries[mesh.name];
                for (let material of mesh.materials) {
                    fileLoader.load(material.path, function (data) {
                        if (material.name === null) {
                            material.name = getDefaultPrimName(data);
                        }
                        if (materials[material.name] === undefined) {
                            console.log('Load the material:', material.path);
                            const materialData = getMaterialData(data, material.name, material.sdfPath);
                            const diffuseColor = materialData.diffuseColor;
                            const opacity = materialData.opacity;
                            if (typeof (diffuseColor) === "string") {
                                let texturePath = diffuseColor;
                                if (!texturePath.startsWith('/')) {
                                    texturePath = getParentDirectory(mesh.path) + texturePath;
                                }
                                const texture = new THREE.TextureLoader().load(texturePath);
                                materials[material.name] = new THREE.MeshBasicMaterial({ map: texture });
                            }
                            else {
                                materials[material.name] = new THREE.MeshBasicMaterial({ color: new THREE.Color(diffuseColor[0], diffuseColor[1], diffuseColor[2]), opacity: opacity });
                            }
                        }
                        
                        const meshMaterialJS = materials[material.name];
                        const meshMeshJS = createMesh(geometry, meshMaterialJS);
                        meshMeshJS.position.set(0, 0, 0);
                        meshMeshJS.rotation.set(0, 0, 0);
                        meshMeshJS.scale.set(1, 1, 1);
                        scene.add(meshMeshJS);
                    });
                }
            },
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            function (error) {
                console.log(error);
            }
        );
    }
});

///////////////
// Main loop //
///////////////

function animate(time_in_ms) {
    requestAnimationFrame(animate);

    const angular_velocity = Math.PI; // rad/s

    // box.rotation.z = time_in_ms / 1000 * angular_velocity;

    renderer.render(scene, camera);
}

if (WebGL.isWebGLAvailable()) {
    // Initiate function or other initializations here
    animate();
}
else {
    const warning = WebGL.getWebGLErrorMessage();
    document.getElementById('container').appendChild(warning);
}