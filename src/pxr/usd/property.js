export class Property {
    constructor(name) {
        if (name.endsWith('.connect')) {
            this._name = name.slice(0, -8);
        } else {
            this._name = name;
        }
    }

    GetBaseName() {
        return this._name;
    }
}