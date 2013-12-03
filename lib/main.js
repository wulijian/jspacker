/**
 * todo:支持requireJS
 * todo:支持OzJS
 *
 * @date 12-12-17
 * @describe: 完成对 commonJS 类模块的合并压缩功能
 * @author: KnightWu
 * @version:  0.0.1
 */
var fs = require('fs');
var path = require('path');
var uglify = require('uglify-js');
var resolvepath = require('./resolvepath');

var scriptBasePath , businessOutput;


const baseModuleFile = path.resolve(__dirname, './Module1.1.1');

var currentPath = process.cwd();

//生成代码的配置
var generateOptions = require('./codeStyle.json');

/**
 * 获取压缩混淆后的代码
 * @param ast 压缩前的语法树
 * @return {String} 结果代码
 */
var getCompressedCode = function (ast) {
    // compressor needs figure_out_scope too
    ast.figure_out_scope();
    var compressor = uglify.Compressor({warnings: false});
    ast = ast.transform(compressor);

    ast.figure_out_scope();
    ast.compute_char_frequency();
    ast.mangle_names();

    // get Ugly code back :)
    return ast.print_to_string();
};

/**
 * 统一js代码中出现的模块的名字，使用当前模块绝对路径截取根路径作为 moduleID
 * @param currentModulePath   当前模块路径
 * @return {String}  计算后的路径
 */
var uniteModuleId = function (currentModulePath) {
    return currentModulePath
        .replace(scriptBasePath, '')
        .replace(/\\/g, '/')
        .replace(/.js$/g, '');
};

var dependencies = {};
/**
 * 记录本模块依赖关系
 * @param moduleId 当前模块id
 * @param currentModulePath 当前模块路径
 * @param foreignModuleRealPath 依赖模块路径
 */
var recodeDependencies = function (moduleId, currentModulePath, foreignModuleRealPath) {
    if (!dependencies[currentModulePath][foreignModuleRealPath]) {
        dependencies[currentModulePath].push({
            basePath: path.dirname(currentModulePath),
            moduleId: moduleId,
            fullPath: foreignModuleRealPath
        });
        dependencies[currentModulePath][foreignModuleRealPath] = true;
    }
};

/**
 * 遍历，处理 define 的第一个参数
 * 如果有一个或两个参数，
 * define(function(require, exports, module){ ... });
 * define([...],function(require, exports, module){ ... });
 * 转成
 * define(moduleID[, [...]],function(require, exports, module){ ... })
 *
 * 如果 define 有三个参数
 * define(currentModulePath,[...], function(require, exports, module){ ... });
 * 则替换第一个参数的id 为 moduleID
 * define(moduleID, [...], function(require, exports, module){ ... });
 *
 * @param node 是define调用的节点
 * @param currentModulePath 代码文件地址
 * @return node 返回处理过moduleID的define节点
 */
var uniteDefine = function (node, currentModulePath) {
    var moduleID = new uglify.AST_String({
        "value": uniteModuleId(currentModulePath)
    });

    if (node.args.length === 3) {
        node.args[0] = moduleID;
    } else {
        node.args.unshift(moduleID);

    }
    return node;
};

/**
 * 处理require调用中的相对路径为define中的绝对路径
 * @param node
 * @param currentModulePath
 * @returns {*}
 */
var uniteRequire = function (node, currentModulePath) {
    var foreignModuleRealPath = resolvepath(path.dirname(currentModulePath), node.args[0].value);  //获取依赖模块的绝对地址
    recodeDependencies(node.args[0].value, currentModulePath, foreignModuleRealPath);
    node.args[0].value = uniteModuleId(foreignModuleRealPath);
    return node;
};

/**
 * 处理此路径处的模块的代码，统一其define的模块id名称，统一require模块路径，并记录依赖的模块路径
 * @param moduleRealPath  模块的绝对路径
 * @returns {*} 返回一个uglify的语法树对象
 */
var handleModule = function (moduleRealPath) {
    var moduleCode = fs.readFileSync(moduleRealPath, 'utf-8');
    var moduleAST = uglify.parse(moduleCode.toString(), {
        filename: moduleRealPath
    });

    return moduleAST.transform(new uglify.TreeTransformer(null, function (node, descend) {
        if (node instanceof uglify.AST_Call) {
            switch (node.expression.name) {
                case 'define':
                    return uniteDefine(node, moduleRealPath);
                case 'require':
                    if (node.args[0].value.indexOf('m.css') === -1) {
                        return uniteRequire(node, moduleRealPath);
                    } else {
                        return uglify.parse('');
                    }
            }
        }
    }));
};

var allModule = {};
/**
 * 遍历所有的模块
 * @param modulePath 模块路径
 * @param moduleId 模块ID
 * @param pre 递归前的操作（进栈前）
 * @param after 递归后的操作（出栈操作）
 */
exports.walkAllModules = function walkAll(modulePath, moduleId, pre, after) {
    try {
        var moduleRealPath = resolvepath(modulePath, moduleId);
        var moduleDependence = dependencies[moduleRealPath] = [];  //重置依赖关系数组
        var result = pre(moduleRealPath, moduleId);
        for (var index = 0, length = moduleDependence.length; index < length; index++) {
            if (!allModule[moduleDependence[index].fullPath]) { //记录依赖
                allModule[moduleDependence[index].fullPath] = true;
                walkAll(moduleDependence[index].basePath, moduleDependence[index].moduleId, pre, after);
            }
        }
        console.log(moduleRealPath.replace(currentPath, ''));
        after(result, moduleId);
    } catch (err) {
        console.error(err);
    }
};

var combinedCode = '', // 合并的代码
    compressedCode = ''; //合并并压缩的代码

/**
 * 初始化commonJS核心模块
 * 静态解析，define require exports module声明等
 */
var initCommonJSModuleCore = function () {
    var moduleImp = fs.readFileSync(baseModuleFile + '.js', 'utf-8');
    combinedCode += moduleImp.toString();
    compressedCode += getCompressedCode(
        uglify.parse(
            moduleImp.toString(),
            {filename: baseModuleFile}
        )
    );
};

/**
 * 将处理过的代码缓存，最终输出到指定的文件夹
 * @param result
 * @param moduleId
 * @param mainModule
 */
var writeUglifyCode = function (result, moduleId, mainModule) {
    var moduleCode = result.print_to_string(generateOptions);
    combinedCode += moduleCode;
    // 这里再进行一遍parse，是修复一个ufligy的奇怪错误，如果直接使用result，可能导致 js 的label标签压缩时候丢失，造成错误
    // Use:for(){ continue Use}, 压缩后会变成 for(){ continue Use},正确的应该是 f:for(){continue f};
    compressedCode += getCompressedCode(uglify.parse(moduleCode)) + '\n';
    if (moduleId === mainModule) {
        fs.writeFileSync(businessOutput + '.js', combinedCode);
        fs.writeFileSync(businessOutput + '-min.js', compressedCode);
    }
};

/**
 *
 * 打包所有主模块相关的js模块
 * @param mainModule 主模块
 * @param output 输出路径
 * @param moduleName 输出名称
 * @param rootPath 根路径（用来缩短路径）
 * @param config 配置对象或配置文件地址
 */
exports.pack = function (mainModule, output, moduleName, rootPath, config) {
    resolvepath.initConfigs(config);
    scriptBasePath = path.resolve(__dirname, rootPath);
    businessOutput = path.resolve(__dirname, output) + '/' + moduleName;
    //创建dist目录
    if (output && !fs.existsSync(output)) {
        fs.mkdirSync(output);
    }
    initCommonJSModuleCore();
    console.log("[concat files]:");
    exports.walkAllModules(
        __dirname,
        mainModule,
        function (moduleRealPath, moduleId) {
            return handleModule(moduleRealPath);
        },
        function (result, moduleId) {
            writeUglifyCode(result, moduleId, mainModule);
        }
    );
    console.log("\n-------------------------------\n" +
        "Compress done.");
};