import { Path } from './../sdf/path.js';

export class Relationship {
    constructor(paths) {
        if (paths.startsWith('[') && paths.endsWith(']')) {
            for (let path of paths.slice(1, paths.length - 1).split(',')) {
                path = path.slice(1, path.length - 1);
                this._paths.push(new Path(path));
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
}