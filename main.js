import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import WebGL from 'three/addons/capabilities/WebGL.js';

// Create a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// Create a camera
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 10000);
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
import { getObject3DFromXform } from './src/multiverse/multiverse_view.js';
import { createGuiFromStage } from './src/multiverse/multiverse_gui.js';

let object3D = null;

let stage = null;

async function usdView(path) {
    try {
        stage = await Usd.Stage.Open(path);
        const defaultPrim = stage.GetDefaultPrim();
        object3D = getObject3DFromXform(defaultPrim);
        scene.add(object3D);

        createGuiFromStage(stage);
    } catch (error) {
        console.error('Failed to load file:', error);
    }
}

// const usdFilePath = '/assets/milk_box/milk_box_flatten.usda';
// const usdFilePath = '/assets/panda/panda_flatten.usda';
const usdFilePath = '/assets/ApartmentECAI/ApartmentECAI_flatten.usda';

usdView(usdFilePath);

document.getElementById('downloadBtn').addEventListener('click', () => {
    if (stage == null) {
        console.error('Stage is null');
        return;
    }

    // Define the text content of the file
    const fileContent = stage.ExportToString();

    // Create a blob with the file content
    const blob = new Blob([fileContent], { type: 'text/plain' });

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = usdFilePath.split('/').pop();

    // Append the link to the body
    document.body.appendChild(link);

    // Programatically click the link to trigger the download
    link.click();

    // Remove the link from the body
    document.body.removeChild(link);
});

///////////////
// Main loop //
///////////////

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