import { Property } from './property.js';
import { Path } from './../sdf/path.js';

function addRelationship(relationship, path) {
    let oldRelationship = `rel ${relationship.GetBaseName()}`;
    let newRelationship = `rel ${relationship.GetBaseName()}`;
    if (relationship._paths.length === 0) {
        relationship._paths.push(new Path(path));
        newRelationship += ` = [<${path}>]`;
    } else {
        oldRelationship += ` = [`;
        for (let i = 0; i < relationship._paths.length; i++) {
            oldRelationship += `<${relationship._paths[i].pathString}>`;
            if (i < relationship._paths.length - 1) {
                oldRelationship += ', ';
            }
        }
        oldRelationship += ']\n';

        relationship._paths.push(new Path(path));
        
        newRelationship += ` = [`;
        for (let i = 0; i < relationship._paths.length; i++) {
            newRelationship += `<${relationship._paths[i].pathString}>`;
            if (i < relationship._paths.length - 1) {
                newRelationship += ', ';
            }
        }
        newRelationship += ']\n';
    }

    updateRelationship(relationship, oldRelationship, newRelationship);
}

function removeRelationship(relationship, i) {
    let oldRelationship = `rel ${relationship.GetBaseName()}`;
    let newRelationship = `rel ${relationship.GetBaseName()}`;
    if (relationship._paths.length > 0) {
        oldRelationship += ` = [`;
        for (let i = 0; i < relationship._paths.length; i++) {
            oldRelationship += `<${relationship._paths[i].pathString}>`;
            if (i < relationship._paths.length - 1) {
                oldRelationship += ', ';
            }
        }
        oldRelationship += ']\n';
        
        relationship._paths.splice(i, 1);

        if (relationship._paths.length > 0) {
            newRelationship += ` = [`;
            for (let i = 0; i < relationship._paths.length; i++) {
                newRelationship += `<${relationship._paths[i].pathString}>`;
                if (i < relationship._paths.length - 1) {
                    newRelationship += ', ';
                }
            }
            newRelationship += ']';
        }
        newRelationship += '\n';
    }

    updateRelationship(relationship, oldRelationship, newRelationship);
}

function updateRelationship(relationship, oldRelationship, newRelationship) {
    const prim = relationship.GetPrim();
    const stage = prim.GetStage();
    const primBlockStartIndex = prim._data.contentIndex.primBlockStartIndex;
    const primBlockEndIndex = prim._data.contentIndex.primBlockEndIndex;

    const stageContent = stage.ExportToString();
    const oldPrimContent = stageContent.substring(primBlockStartIndex, primBlockEndIndex);
    const newPrimContent = oldPrimContent.replace(oldRelationship, newRelationship);
    stage._content = stageContent.substring(0, primBlockStartIndex) + newPrimContent + stageContent.substring(primBlockEndIndex);

    prim._data.contentIndex.primBlockEndIndex += newPrimContent.length - oldPrimContent.length;
    prim._data.contentIndex.endIndex += newPrimContent.length - oldPrimContent.length;
}

export class Relationship extends Property {
    constructor(prim, name, paths) {
        super(prim, name);
        this._paths = [];
        if (paths.startsWith('[') && paths.endsWith(']')) {
            paths = paths.replace(/ /g, '');
            for (let path of paths.slice(1, paths.length - 1).split(',')) {
                path = path.slice(1, path.length - 1);
                if (path.startsWith('/')) {
                    this._paths.push(new Path(path));
                }
            }
        } else {
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
                return true;
            }
        }

        addRelationship(this, path);

        return true;
    }

    RemoveTarget(path) {
        for (let i = 0; i < this._paths.length; i++) {
            if (this._paths[i].pathString === path) {
                removeRelationship(this, i);
                return true;
            }
        }

        return false;
    }
}