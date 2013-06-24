var path = require('path');
var utils = require('./utils');

/**
 *{
     *   "alias": {  别名
     *       "jquery": "lib/jquery.js"
     *  },
     *   "paths": {  路径变量
     *       "render": "src/scripts/render"
     *   },
     *   "base": "E:/path/to/project"  必须使用本地绝对路径
     *}
 */
var commonJSConfig = null;

var SUFFIX = '.js';
/**
 * id 类型正则
 * @type {{
 * ABSOLUTE: RegExp,
 *   RELATIVE: RegExp,
 *   ROOT: RegExp,
 *   ROOT_DIR: RegExp,
 *   PATHS: RegExp
 * }}
 */
var idTypeRegs = {
    "ABSOLUTE": /(?:^|:)\/\/./,  //绝对路径
    "RELATIVE": /^\./,           //相对路径
    "ROOT": /^\//,               //根路径
    "ROOT_DIR": /^.*?\/\/.*?\//, //根文件
    "PATHS": /^([^/:]+)(\/.+)$/  //全局路径
};

/**
 * 获取 id 的类型
 * @param id
 * @returns {*}
 */
var getIdType = function (id) {
    for (var type in idTypeRegs) {
        if (idTypeRegs.hasOwnProperty(type)) {
            if (idTypeRegs[type].test(id)) {
                return type;
            }
        }
    }
};

/**
 * 解析别名
 * @param id
 * @returns {*}
 */
var parseAlias = function (id) {
    var alias = commonJSConfig.alias;
    return alias && utils.isString(alias[id]) ? alias[id] : id;
};

/**
 * 解析全局类型
 * @param resultPath
 * @returns {*}
 */
var parsePaths = function (resultPath) {
    var paths = commonJSConfig.paths;
    if (paths) {
        var pathMatch = resultPath.match(idTypeRegs["PATHS"]);
        if (pathMatch && utils.isString(paths[pathMatch[1]])) {
            resultPath = paths[pathMatch[1]] + pathMatch[2] + SUFFIX;
        }
    }
    return resultPath;
};

/**
 * 添加 base 路径
 * @param resultPath
 * @returns {*}
 */
var appendBase = function (resultPath) {
    if (idTypeRegs["PATHS"].test(resultPath)) {
        resultPath = path.resolve(commonJSConfig.base, resultPath);
    }
    return resultPath;
};

/**
 * 添加后缀
 * @param resultPath
 * @returns {*}
 */
var addSuffix = function (resultPath) {
    if (path.extname(resultPath) !== '.js'&&
        path.extname(resultPath) !== '.json') {
        resultPath += SUFFIX;
    }
    return resultPath;
};

module.exports = function (modulePath, id) {
    var resultPath = parseAlias(id);
    switch (getIdType(resultPath)) {
        case "RELATIVE":
            resultPath = path.resolve(modulePath, resultPath);
            break;
        case "PATHS":
            resultPath = parsePaths(resultPath);
    }
    resultPath = appendBase(resultPath);
    resultPath = addSuffix(resultPath);
    return resultPath;
};
/**
 *
 * @param config
 * configPath  .json or nodejs module
 * config obj
 * @returns {*}
 */
module.exports.initConfigs = function (config) {
    commonJSConfig = config || {
        /**
         * commonJS 和 nodejs 都可以加载此模块
         * -------- begin -----------*/
        "alias": {
        },
        "paths": {
        },
        "debug": true,
        "base": "", //请保证修改好此端口后，修改 http.port
        /* --------end-----------*/

        /**
         * 打包模块, 可设置多个
         * path 是要打包文件的入口模块路径
         * name 是输出文件名称
         * -------- begin -----------*/
        "packModules": [
            {"path": "src/scripts/index", "name": "business"}
        ]
        /* --------end-----------*/
    };
    if (utils.isString(config)) {
        var realPath = path.resolve(__dirname, config);
        commonJSConfig = require(realPath);
    }
};
