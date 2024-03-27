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

function getHeaderSection(stageContent) {
    const headerRegex = /#usda 1.0\s*\(([^)]+)\)/s;
    const headerMatch = stageContent.match(headerRegex);
    let headerSection = '';

    if (headerMatch && headerMatch[0]) {
        headerSection = headerMatch[0];
    } else {
        throw new Error('No header found in the stage');
    }

    return headerSection;
}

function getDefaultPrimName(stageContent) {
    const headerSection = getHeaderSection(stageContent);

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
        this.GetPrimAtPath('/');
        const defaultPrimName = getDefaultPrimName(this._content);
        this._defaultPrim = this.GetPrimAtPath('/' + defaultPrimName);
    }

    static async Open(path) {
        const content = await Open(path);
        if (content.length === 0) {
            throw new Error('Failed to open stage');
        }
        return new Stage(content);
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
        return this.GetPrimAtPath('/').GetAllChildren();
    }

    Save() {
        const stageContent = this.ExportToString();
        let saveContent = getHeaderSection(stageContent) + '\n\n';
        
        for (let prim of this.Traverse()) {
            if (prim.GetChildren().lenth > 0) {
                const primContent = stageContent.substring(prim._data.contentIndex.startIndex, prim._data.contentIndex.primBlockEndIndex);
                saveContent += primContent + '\n\n';
            } else {
                const primContent = stageContent.substring(prim._data.contentIndex.startIndex, prim._data.contentIndex.endIndex);
                saveContent += primContent + '\n\n';
            }
        }

        return saveContent;
    }
}

