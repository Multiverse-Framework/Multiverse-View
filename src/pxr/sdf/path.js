export class Path {
    constructor(path) {
        if (path.constructor.name === 'Path') {
            path = path.pathString;
        }
        this.pathString = path;
        if (this.pathString.includes('.')) {
            this.name = path.split('.').pop();
        } else {
            this.name = path === '/' ? '/' : path.split('/').pop();
        }
    }

    GetParentPath() {
        let parentPath;
        if (this.pathString.includes('.')) {
            parentPath = this.pathString.slice(0, this.pathString.lastIndexOf('.'));
        } else {
            parentPath = this.pathString.slice(0, this.pathString.lastIndexOf('/'));
            if (parentPath === '') {
                parentPath = '/';
            }
        }
        return new Path(parentPath);
    }
}