var class2type = {}, toString = class2type.toString;
/**
 * 判断对象类型
 * @param obj
 */
exports.type = function (obj) {
    return obj == null ? String(obj) :
        class2type[toString.call(obj)] || "object"
};

['Boolean', 'Number', 'String', 'Function', 'Array', 'Date', 'RegExp', 'Object', 'Error'].forEach(function (val, idx) {
    class2type["[object " + val + "]"] = val.toLowerCase();
    exports['is' + val] = function (obj) {
        return exports.type(obj) === val.toLowerCase();
    };
});