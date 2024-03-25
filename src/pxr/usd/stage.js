import * as THREE from 'three';

import { Prim } from './prim.js';

function Open(path) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.FileLoader();

        loader.load(path,
            data => resolve(data), // Resolve the promise with the content
            xhr => console.log(path + ' ' + (xhr.loaded / xhr.total * 100) + '% loaded'),
            err => reject(err) // Reject the promise on error
        );
    });
}

function getDefaultPrimName(stageContent) {
    // Match everything from '#usda 1.0' up to the first occurrence of a line not part of the header
    const headerRegex = /#usda 1.0\s*\(([^)]+)\)/s;
    const headerMatch = stageContent.match(headerRegex);
    let headerSection = '';

    if (headerMatch && headerMatch[0]) {
        headerSection = headerMatch[0];
    } else {
        console.error('No header found in the stage');
        return null;
    }

    const defaultPrimRegex = /defaultPrim\s*=\s*"([^"]+)"/;
    const defaultPrimMatch = headerSection.match(defaultPrimRegex);

    if (defaultPrimMatch && defaultPrimMatch[1]) {
        return defaultPrimMatch[1];
    } else {
        console.error('No defaultPrim found in the header');
        return null;
    }
}

export class Stage {
    constructor(content) {
        this._content = content;
        this._primsCached = {};
        const defaultPrimName = getDefaultPrimName(this._content);
        this._defaultPrim = this.GetPrimAtPath('/' + defaultPrimName);
    }

    static async Open(path) {
        try {
            const content = await Open(path);
            return new Stage(content);
        } catch (error) {
            console.error('Failed to load file:', error);
        }
    }

    ExportToString() {
        return this._content;
    }

    GetDefaultPrim() {
        return this._defaultPrim;
    }

    GetPrimAtPath(path) {
        if (path.constructor.name === 'Path') {
            path = path.pathString;
        }

        if (path in this._primsCached) {
            return this._primsCached[path];
        } else {
            return new Prim(this, path);
        }
    }

    Traverse() {
        // Convert this._primsCached to an array of prims
        return Object.values(this._primsCached);
    }
}

