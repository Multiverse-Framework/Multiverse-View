import { Property } from './property.js';
import { Path } from './../sdf/path.js';

export class Relationship extends Property {
    constructor(prim, name, paths) {
        super(prim, name);
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

        let oldRelationship = `rel ${this.GetBaseName()}`;
        let newRelationship = `rel ${this.GetBaseName()}`;
        if (this._paths.length === 0) {
            this._paths.push(new Path(path));
            newRelationship += ` = [<${path}>]`;
        } else {
            this._paths.push(new Path(path));
            newRelationship += ` = [`;
            for (let i = 0; i < this._paths.length; i++) {
                newRelationship += `<${this._paths[i].pathString}>`;
                if (i < this._paths.length - 1) {
                    newRelationship += ', ';
                }
            }
            newRelationship += ']';
        }

        let prim = this.GetPrim();
        let stage = prim.GetStage();
        let startIndex = prim._data.contentIndex.primBlockEndIndex;
            
        let stageContent = stage.ExportToString();
        const oldPrimContent = stageContent.substring(prim._data.contentIndex.startIdex, prim._data.contentIndex.primBlockEndIndex);
        const newPrimContent = oldPrimContent.replace(oldRelationship, newRelationship);
        stage._content = stageContent.substring(0, startIndex) + newPrimContent + stageContent.substring(startIndex);

        prim._data.contentIndex.primBlockEndIndex += newPrimContent.length - oldPrimContent.length;
        prim._data.contentIndex.endIndex += newPrimContent.length - oldPrimContent.length;
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