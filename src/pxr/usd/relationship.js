import { Property } from './property.js';
import { Path } from './../sdf/path.js';

export class Relationship extends Property {
    constructor(name, paths) {
        super(name);
        this._paths = [];
        if (paths.startsWith('[') && paths.endsWith(']')) {
            for (let path of paths.slice(1, paths.length - 1).split(',')) {
                path = path.slice(1, path.length - 1);
                if (path !== '') {
                    this._paths.push(new Path(path));
                }
            }
        }
        else {
            paths = paths.slice(1, paths.length - 1);
            this._paths = [new Path(paths)];
        }
    }

    GetTargets() {
        return this._paths;
    }

    AddTarget(path) {
        for (let p of this._paths) {
            if (p.pathString === path) {
                return;
            }
        }
        this._paths.push(new Path(path));
    }

    RemoveTarget(path) {
        for (let i = 0; i < this._paths.length; i++) {
            if (this._paths[i].pathString === path) {
                this._paths.splice(i, 1);
                return true;
            }
        }
        return false;
    }
}