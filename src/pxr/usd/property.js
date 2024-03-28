export class Property {
    constructor(prim, name) {
        this._prim = prim;
        if (name.endsWith('.connect')) {
            this._name = name.slice(0, -8);
        } else {
            this._name = name;
        }
    }

    GetPrim() {
        return this._prim;
    }

    GetPrimPath() {
        return this.GetPrim().GetPath();
    }

    GetBaseName() {
        return this._name;
    }
}