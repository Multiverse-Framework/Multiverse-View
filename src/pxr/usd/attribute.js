import { ValueTypeName, getValueFromTypeName } from '../sdf/types.js';
import { Path } from '../sdf/path.js';

export class Attribute {
    constructor(name, type, value = null) {
        this._valueTypeName = new ValueTypeName(type);
        if (name.endsWith('.connect')) {
            this._name = name.slice(0, -8);
            this._value = null;
            this._connections = [new Path(value.slice(1, -1))];
        } else {
            this._name = name;
            this._value = getValueFromTypeName(value, this._valueTypeName.cppTypeName);
            this._connections = [];
        }
    }

    GetTypeName() {
        return this._valueTypeName;
    }

    GetName() {
        return this._name;
    }

    Get() {
        return this._value;
    }

    GetConnections() {
        return this._connections;
    }
}