import { Attribute } from './attribute.js';
import { Relationship } from './relationship.js';
import { Path } from './../sdf/path.js';

function splitPath(path) {
    const parts = path.split('/');
    return parts.filter(part => part !== '');
}

function extractPrimContentFromName(primName, primContent, startIndexMustEqualZero = false) {
    const regexPattern = `def\\s+.+?\\s+"${primName}"`;
    const primStartPattern = new RegExp(regexPattern);

    return extractPrimContentFromStartPattern(primContent, primStartPattern, startIndexMustEqualZero);
}

function extractPrimContentFromStartPattern(primContent, primStartPattern, startIndexMustEqualZero = false) {
    const startIndex = primContent.search(primStartPattern);

    if (startIndex === -1) {
        return null; // Prim block not found
    }
    if (startIndexMustEqualZero && startIndex !== 0) {
        return null;
    }

    let openBraces = 0;
    let endIndex = startIndex;

    // Start searching from the point where the prim block starts
    for (let i = startIndex; i < primContent.length; i++) {
        if (primContent[i] === '{') {
            openBraces++;
        } else if (primContent[i] === '}') {
            openBraces--;
            if (openBraces === 0) { // Found the matching closing brace
                endIndex = i;
                break;
            }
        }
    }

    if (endIndex === startIndex) {
        return null; // Matching closing brace not found
    }

    return primContent.substring(startIndex, endIndex + 1);
}

function extractPrimDataFromBrace(primContent, startBrace, endBrace) {
    let braceCount = 0;
    let insidePrim = false;
    let primContentStart = -1;
    let primContentEnd = -1;

    // Start searching from the found prim block
    for (let i = 0; i < primContent.length; i++) {
        const char = primContent[i];

        if (char === startBrace) {
            braceCount++;
            if (!insidePrim) {
                insidePrim = true;
                primContentStart = i + 1; // Content starts after this brace
            }
        } else if (char === endBrace) {
            braceCount--;
        }

        if (insidePrim && braceCount === 0) {
            primContentEnd = i; // Content ends before this brace
            break;
        }
    }

    if (primContentStart === -1 || primContentEnd === -1) {
        return null; // Proper content block not found
    }

    // Extract the content block
    return primContent.substring(primContentStart, primContentEnd).trim();
}

function extractPrimHeader(primHeader) {
    let apiSchemas = [];
    const apiSchemaPattern = /prepend apiSchemas = \[([^\]]+)\]/g;
    let apiSchemaMatch;
    while ((apiSchemaMatch = apiSchemaPattern.exec(primHeader)) !== null) {
        const schemas = apiSchemaMatch[1].split(',').map(schema =>
            schema.trim().replace(/"/g, '') // Escaping double quotes
        );
        apiSchemas = apiSchemas.concat(schemas);
    }

    let references = [];
    const referencePattern = /prepend references = @([^@]+)@<\/([^>]+)>/g;
    let referenceMatch;
    while ((referenceMatch = referencePattern.exec(primHeader)) !== null) {
        references.push({ path: referenceMatch[1], name: referenceMatch[2] });
    }

    return {
        apiSchemas: apiSchemas,
        references: references,
    };
}

function extractPrimData(primContent) {
    const primType = primContent.match(/def\s+(.+?)\s+"/)[1];

    let primHeader = extractPrimDataFromBrace(primContent, "(", ")");
    if (primHeader !== null) {
        primHeader = extractPrimHeader(primHeader);
    }

    let primBlock = extractPrimDataFromBrace(primContent, "{", "}");

    // Further processing to exclude child definitions like 'def Mesh', if necessary
    let childPrimContents = [];

    let childDefIndex = primBlock.search(/def\s+/);

    if (childDefIndex !== -1) {
        let childPrimsContent = primBlock.substring(childDefIndex).trim();

        primBlock = primBlock.substring(0, childDefIndex).trim();

        while (childDefIndex !== -1) {
            const childPrimContent = extractPrimContentFromStartPattern(childPrimsContent, /def\s+/);

            childPrimContents.push(childPrimContent);

            childPrimsContent = childPrimsContent.substring(childPrimContent.length).trim();

            childDefIndex = childPrimsContent.search(/def\s+/);
        }
    }

    return {
        primType: primType,
        primHeader: primHeader,
        primProperties: getPrimProperties(primBlock),
        childPrimContents: childPrimContents
    };
}

function getPrimProperties(primBlock) {
    const lines = primBlock.split('\n');
    const result = {};

    lines.forEach(line => {
        line = line.replace('uniform ', '');
        line = line.replace('prepend ', '');
        if (line.trim() !== '') {
            const lineTrim = line.trim();
            if (lineTrim.startsWith('#') ||
                lineTrim.startsWith('{') || lineTrim.startsWith('}') ||
                lineTrim.startsWith('(') || lineTrim.startsWith(')') ||
                lineTrim.startsWith('[ ') || lineTrim.startsWith(']')) {
                return;
            }
            
            const [fullKey, valueString] = line.split('=');
            const [type, name] = fullKey.trim().split(' ');

            if (valueString === undefined) {
                result[name] = null;
                return;
            }

            const trimmedValueString = valueString.trim();

            if (name === undefined) {
                return;
            }

            if (type === 'rel') {
                result[name] = new Relationship(trimmedValueString);
            }
            else {
                result[name.replace('.connect', '')] = new Attribute(name, type, trimmedValueString);
            }
        }
    });

    return result;
}

function getPrimData(primStage, primPath, primContent) {
    let primName;
    let primData;
    let parentPrimPath = '';
    let childPrims = [];
    for (primName of splitPath(primPath)) {
        parentPrimPath += '/' + primName;
        const tmpPrimContent = extractPrimContentFromName(primName, primContent, false);
        if (tmpPrimContent === null) {
            continue;
        } 
        primContent = tmpPrimContent;
        primData = extractPrimData(primContent);
        for (let childPrimContent of primData.childPrimContents) {
            const childPrimName = childPrimContent.match(/def\s+.+?\s+"([^"]+)"/)[1];
            if (childPrimName) {
                childPrims.push(new Prim(primStage, `${parentPrimPath}/${childPrimName}`, childPrimContent));
            }
        }
    }

    return {
        name: primName,
        data: primData,
        children: childPrims
    }
}

export class Prim {
    constructor(stage, path, content = null) {
        this._stage = stage;
        this._path = new Path(path);
        if (content === null) {
            content = stage.ExportToString();
        }
        this._data = getPrimData(stage, path, content);
        if (!(path in stage._primsCached)) {
            stage._primsCached[path] = this;
        }
    }

    GetStage() {
        return this._stage;
    }

    GetPath() {
        return this._path;
    }

    GetName() {
        return this._data.name;
    }

    GetProperties() {
        return this._data.data.primProperties;
    }

    GetProperty(propertyName) {
        return this.GetProperties()[propertyName];
    }

    GetChildren() {
        return this._data.children;
    }

    GetAllChildren() {
        let children = [];
        for (let child of this.GetChildren()) {
            children.push(child);
            children = children.concat(child.GetAllChildren());
        }
        return children;
    }

    GetParent() {
        return this.GetStage().GetPrimAtPath(this.GetPath().GetParentPath());
    }

    GetTypeName() {
        return this._data.data.primType;
    }

    HasProperty(propertyName) {
        return propertyName in this.GetProperties();
    }
}