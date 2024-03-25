import { Matrix3, Matrix4, Vector2, Vector3, Quaternion } from 'three';

const cppTypeNames = {
    "bool": "bool",
    "uchar": "uint8_t",
    "int": "int32_t",
    "uint": "uint32_t",
    "int64": "int64_t",
    "uint64": "uint64_t",
    "half": "GfHalf",
    "float": "float",
    "double": "double",
    "timecode": "SdfTimeCode",
    "string": "std::string",
    "token": "TfToken",
    "asset": "SdfAssetPath",
    "opaque": "SdfOpaqueValue",
    "matrix2d": "GfMatrix2d",
    "matrix3d": "GfMatrix3d",
    "matrix4d": "GfMatrix4d",
    "quatd": "GfQuatd",
    "quatf": "GfQuatf",
    "quath": "GfQuath",
    "double2": "GfVec2d",
    "float2": "GfVec2f",
    "half2": "GfVec2h",
    "int2": "GfVec2i",
    "double3": "GfVec3d",
    "float3": "GfVec3f",
    "half3": "GfVec3h",
    "int3": "GfVec3i",
    "double4": "GfVec4d",
    "float4": "GfVec4f",
    "half4": "GfVec4h",
    "int4": "GfVec4i",

    "bool[]": "VtArray<bool>",
    "uchar[]": "VtArray<uint8_t>",
    "int[]": "VtArray<int32_t>",
    "uint[]": "VtArray<uint32_t>",
    "int64[]": "VtArray<int64_t>",
    "uint64[]": "VtArray<uint64_t>",
    "half[]": "VtArray<GfHalf>",
    "float[]": "VtArray<float>",
    "double[]": "VtArray<double>",
    "timecode[]": "VtArray<SdfTimeCode>",
    "string[]": "VtArray<std>::string",
    "token[]": "VtArray<TfToken>",
    "asset[]": "VtArray<SdfAssetPath>",
    "opaque[]": "VtArray<SdfOpaqueValue>",
    "matrix2d[]": "VtArray<GfMatrix2d>",
    "matrix3d[]": "VtArray<GfMatrix3d>",
    "matrix4d[]": "VtArray<GfMatrix4d>",
    "quatd[]": "VtArray<GfQuatd>",
    "quatf[]": "VtArray<GfQuatf>",
    "quath[]": "VtArray<GfQuath>",
    "double2[]": "VtArray<GfVec2d>",
    "float2[]": "VtArray<GfVec2f>",
    "half2[]": "VtArray<GfVec2h>",
    "int2[]": "VtArray<GfVec2i>",
    "double3[]": "VtArray<GfVec3d>",
    "float3[]": "VtArray<GfVec3f>",
    "half3[]": "VtArray<GfVec3h>",
    "int3[]": "VtArray<GfVec3i>",
    "double4[]": "VtArray<GfVec4d>",
    "float4[]": "VtArray<GfVec4f>",
    "half4[]": "VtArray<GfVec4h>",
    "int4[]": "VtArray<GfVec4i>",

    "point3d": "GfVec3d",
    "point3f": "GfVec3f",
    "point3h": "GfVec3h",
    "normal3d": "GfVec3d",
    "normal3f": "GfVec3f",
    "normal3h": "GfVec3h",
    "vector3d": "GfVec3d",
    "vector3f": "GfVec3f",
    "vector3h": "GfVec3h",
    "color3d": "GfVec3d",
    "color3f": "GfVec3f",
    "color3h": "GfVec3h",
    "color4d": "GfVec4d",
    "color4f": "GfVec4f",
    "color4h": "GfVec4h",
    "frame4d": "GfMatrix4d",
    "texCoord2d": "GfVec2d",
    "texCoord2f": "GfVec2f",
    "texCoord2h": "GfVec2h",
    "texCoord3d": "GfVec3d",
    "texCoord3f": "GfVec3f",
    "texCoord3h": "GfVec3h",
    "group": "SdfOpaqueValue",

    "point3d[]": "VtArray<GfVec3d>",
    "point3f[]": "VtArray<GfVec3f>",
    "point3h[]": "VtArray<GfVec3h>",
    "normal3d[]": "VtArray<GfVec3d>",
    "normal3f[]": "VtArray<GfVec3f>",
    "normal3h[]": "VtArray<GfVec3h>",
    "vector3d[]": "VtArray<GfVec3d>",
    "vector3f[]": "VtArray<GfVec3f>",
    "vector3h[]": "VtArray<GfVec3h>",
    "color3d[]": "VtArray<GfVec3d>",
    "color3f[]": "VtArray<GfVec3f>",
    "color3h[]": "VtArray<GfVec3h>",
    "color4d[]": "VtArray<GfVec4d>",
    "color4f[]": "VtArray<GfVec4f>",
    "color4h[]": "VtArray<GfVec4h>",
    "frame4d[]": "VtArray<GfMatrix4d>",
    "texCoord2d[]": "VtArray<GfVec2d>",
    "texCoord2f[]": "VtArray<GfVec2f>",
    "texCoord2h[]": "VtArray<GfVec2h>",
    "texCoord3d[]": "VtArray<GfVec3d>",
    "texCoord3f[]": "VtArray<GfVec3f>",
    "texCoord3h[]": "VtArray<GfVec3h>",
    "group[]": "VtArray<SdfOpaqueValue>",
};

export function getValueFromTypeName(value, cppTypeName) {
    if (cppTypeName.startsWith('VtArray<')) {
        const arrayTypeName = cppTypeName.slice(cppTypeName.indexOf('<') + 1, cppTypeName.lastIndexOf('>'));
        if (['GfQuatd', 'GfQuatf', 'GfQuath',
            'GfVec2d', 'GfVec2f', 'GfVec2h', 'GfVec2i',
            'GfVec3d', 'GfVec3f', 'GfVec3h', 'GfVec3i',
            'GfVec4d', 'GfVec4f', 'GfVec4h', 'GfVec4i'].includes(arrayTypeName)) {
            const array = value.slice(1, value.length - 1);
            return array.split('),').map(v => getValueFromTypeName(v + ')', arrayTypeName));
        } else {
            const array = value.slice(1, value.length - 1);
            return array.split(',').map(v => getValueFromTypeName(v, arrayTypeName));
        }
    }

    if (['GfMatrix2d', 'GfMatrix3d', 'GfMatrix4d',
        'GfQuatd', 'GfQuatf', 'GfQuath',
        'GfVec2d', 'GfVec2f', 'GfVec2h', 'GfVec2i',
        'GfVec3d', 'GfVec3f', 'GfVec3h', 'GfVec3i',
        'GfVec4d', 'GfVec4f', 'GfVec4h', 'GfVec4i'].includes(cppTypeName)) {
        value = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'));
        value = value.match(/-?\d*\.?\d+(e-?\d+)?/g).map(parseFloat);
        if (cppTypeName === 'GfMatrix2d') {
            console.error('GfMatrix2d not implemented');
            return null;
        }
        else if (cppTypeName === 'GfMatrix3d') {
            return new Matrix3().fromArray(value)
        }
        else if (cppTypeName === 'GfMatrix4d') {
            return new Matrix4().fromArray(value)
        }
        else if (['GfVec2d', 'GfVec2f', 'GfVec2h', 'GfVec2i'].includes(cppTypeName)) {
            return new Vector2(value[0], value[1]);
        }
        else if (['GfVec3d', 'GfVec3f', 'GfVec3h', 'GfVec3i'].includes(cppTypeName)) {
            return new Vector3(value[0], value[1], value[2]);
        }
        else if (['GfQuatd', 'GfQuatf', 'GfQuath'].includes(cppTypeName)) {
            return new Quaternion(value[0], value[1], value[2], value[3]);
        }
    } else if (cppTypeName === 'bool') {
        return value.toLowerCase() === 'true';
    } else if (['uint8_t', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t'].includes(cppTypeName)) {
        return parseInt(value);
    } else if (['GfHalf', 'float', 'double'].includes(cppTypeName)) {
        return parseFloat(value);
    } else if (cppTypeName === 'SdfTimeCode') {
        console.error('SdfTimeCode not implemented');
        return null;
    } else if (['std::string', 'TfToken'].includes(cppTypeName)) {
        return value.slice(1, value.length - 1);
    } else if (cppTypeName === 'SdfAssetPath') {
        return value.slice(1, value.length - 1);
    } else if (cppTypeName === 'SdfOpaqueValue') {
        console.error('SdfOpaqueValue not implemented');
        return null;
    } else {
        console.error(`Unknown type prefix: ${cppTypeName}`);
        return null;
    }
}

export class ValueTypeName {
    constructor(name) {
        this.cppTypeName = cppTypeNames[name];
    }
}