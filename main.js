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

// Create a camera
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.up.set(0, 0, 1);
camera.position.set(1.0, 1.0, 1.0);
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

// Create a ambient light
const ambientLight = new THREE.AmbientLight(0xffffff);
scene.add(ambientLight);

// Create a plane
// const planeGeometry = new THREE.PlaneGeometry(10, 10);
// const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
// const plane = new THREE.Mesh(planeGeometry, planeMaterial);
// scene.add(plane);

////////////////
// USD import //
////////////////

import { Usd } from './src/pxr/pxr.js';
import { getObject3DFromXform } from './src/multiverse_view/multiverse_view.js';

let object3D = null;

// Create a GUI
const gui = new dat.GUI();

const objectsFolder = gui.addFolder('Objects');

var params = {};



function createGuiFromStage(stage) {
    for (let prim of stage.Traverse()) {
        const primPath = prim.GetPath().pathString;
        params[primPath] = {};

        if (prim.GetTypeName() === 'Mesh') {
            const primMesh = prim.object3D.children[0];
            params[primPath]["color"] = primMesh.material.color.getHex();
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
                params[primPath]["children"].push(childPrimPath);
            }

            params[primPath]["highlight"] = false;
            primFolder.add(params[primPath], "highlight").name("highlight").onChange(function (value) {
                for (let childPrimPath of params[primPath]["children"]) {
                    const childPrim = stage.GetPrimAtPath(childPrimPath);
                    if (childPrim.GetTypeName() === 'Mesh') {
                        const childPrimMesh = childPrim.object3D.children[0];
                        childPrimMesh.material.color.set(value ? 0xffff00 : params[childPrimPath]["color"]);
                    }
                }
            });
        }
    }
}

async function usdView(path) {
    try {
        const stage = await Usd.Stage.Open(path);
        const defaultPrim = stage.GetDefaultPrim();
        object3D = getObject3DFromXform(defaultPrim);
        scene.add(object3D);

        createGuiFromStage(stage);
        
    } catch (error) {
        console.error('Failed to load file:', error);
    }
}

// usdView('/assets/milk_box/milk_box_flatten.usda');
usdView('/assets/panda/panda_flatten.usda');

///////////////
// Main loop //
///////////////

objectsFolder.open();
gui.open();

function animate(time_in_ms) {
    requestAnimationFrame(animate);

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

window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});