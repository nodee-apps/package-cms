'use strict';

var async = require('nodee-utils').async,
    Model = require('nodee-model'),
    fs = require('fs');

var Template = Model.define('CmsTemplate', [ 'FileSystemDataSource' ], {
    // all props are inherited from FileSystemDataSource
});

/*
 * defaults
 */

Template.extendDefaults({
    connection:{
        dirPath:'./views'
    }
});

/*
 * Ensure Indexes
 */
Template.init();

/*
 * Document methods
 */


/*
 * instance methods
 */

function templateBaseProp(templateId){
    return templateId.replace(/^widgets\//,'').replace(/\.html$/,'').replace(/\//g,'_');
}

Template.prototype.getContent = function(cb){ // cb(err, contents)
    var template = this;
    
    // read html file
    template.read(function(err, html){
        if(err) cb(err);
        
        // read json file if exists
        else readIfExists(template, template.id+'.json', function(err, json){
            if(err) cb(err);
            
            // read js file if exists
            else readIfExists(template, template.id+'.js', function(err, js){
                if(err) cb(err);
                else {
                    try {
                        json = JSON.parse(json || '{}');
                        if(!json.view) json = {
                            view: json
                        };
                    }
                    catch(err){
                        return cb(new Error('Cannot read Json file content').cause(err));
                    }
                    
                    cb(null, {
                        modifiedDT: template.modifiedDT,
                        baseProp: json.baseProp || templateBaseProp(template.id),
                        allowedChildTemplates: json.allowedChildTemplates,
                        name: json.name || '',
                        icon: json.icon || '',
                        color: json.color || '',
                        description: json.description || '',
                        
                        html: html.toString(),
                        attributes: json.attributes || [],
                        controller: parseCode('CONTROLLER', js),
                        view_mapping: json.view || {},
                        editors: json.editors || {},
                        parse_mapping: json.parse || {},
                        parser: parseCode('PARSER', js)
                    });
                }
            });
        });
    });
};

var comments =  '/*\n' +
                ' * available variables:\n' +
                ' * Model - base model constructor, use Model(\'MyConstructorName\') to get model constructors\n' +
                ' * Document - reference to CmsDocument, same as Model(\'CmsDocument\')\n' +
                ' * document - document model instance, it has all props including content\n' +
                ' * this - controller or parser \n' +
                ' * data - parsed data, only if parser \n' +
                ' * done - allways call done([optional error object]), because all controllers and parsers are async\n' +
                ' */' +
                '\n\n' +
                '// do something with document, e.g. doccument.title = document.title + \' BLOG POST\';\n' +
                '// done();';
function parseCode(comment, text){
    var code = text.match(new RegExp('\\/\\*' +comment+ '\\*\\/((.|\\r|\\n)*)\\/\\*' +comment+ '\\*\\/','m'));
    code = code ? code[1] : comments;
    return code;
}

// helper for reading files
function readIfExists(template, fileId, cb){ // cb(err, content)
    // read js file if exists
    template.constructor.collection().findId(fileId).one(function(err, file){
        if(err) cb(err);
        else if(file) file.read(function(err, content){
            cb(err, content ? content.toString() : '');
        });
        else cb(null, '');
    });
}

Template.prototype.updateContent = function(contents, cb){ // cb(err, template)
    var template = this;
    
    if(!contents.baseProp) return cb(new Error('Template updateContent: missing "baseProp"').details({ code:'INVALID', validErrs:{ baseProp:['required'] } }));
    
    var json;
    try {
        json = buildTemplateJson(contents);
    }
    catch(err){
        return cb(new Error('Template updateContent: content is not valid JSON').details({ code:'EXECFAIL', cause:err }));
    }
    
    // update html file
    template.write(contents.html, function(err, template){
        if(err) cb(err);
        
        // update json file
        else fs.writeFile(template.fullPath+'.json', json, function(err){
            if(err) cb(err);
            
            // update js file
            else fs.writeFile(template.fullPath+'.js', buildTemplateJs(contents), function(err){
                if(err) cb(err);
                else cb(null, template);
            });
        });
    });
};

function buildTemplateJson(contents){
    return JSON.stringify({
        baseProp: contents.baseProp || '',
        allowedChildTemplates: contents.allowedChildTemplates,
        name: contents.name || '',
        icon: contents.icon || '',
        color: contents.color || '',
        description: contents.description || '',
        
        attributes: contents.attributes || [],
        view: contents.view_mapping,
        editors: contents.editors,
        parse: contents.parse_mapping && Object.keys(contents.parse_mapping).length ? contents.parse_mapping : '', //contents.parse_mapping ? JSON.parse(contents.parse_mapping) : ''
    }, null, 4);
}

function buildTemplateJs(contents){
    var jsFile = "/*DEFAULT DEPENDENCIES*/\n" +
                 "var Model = require('nodee-model'),Document = Model('CmsDocument');\n";
    
    if(typeof contents.controller === 'string' && contents.controller.replace(/\/\*(.|\r|\n)*\*\//gm,'').replace(/^[\s]+/gm,'').match(/^[^\/]/gm)){
        jsFile += "module.exports.controller = function(document, done){\n" +
                  "/*CONTROLLER*/" + contents.controller + "/*CONTROLLER*/\n}\n";
    }
    else if(typeof contents.controller === 'string' && contents.controller && contents.controller !== comments){
        jsFile += "/*CONTROLLER*/" + contents.controller + "/*CONTROLLER*/\n\n";
    }
    
    if(typeof contents.parser === 'string' && contents.parser.replace(/\/\*(.|\r|\n)*\*\//gm,'').replace(/^[\s]+/gm,'').match(/^[^\/]/gm)){
        jsFile += "module.exports.parser = function(data, document, done){\n" +
                  "/*PARSER*/" + contents.parser + "/*PARSER*/\n}\n";
    }
    else if(typeof contents.parser === 'string' && contents.parser && contents.parser !== comments){
        jsFile += "/*PARSER*/" + contents.parser + "/*PARSER*/\n\n";
    }
    
    return jsFile;
}


/*
 * Business logic
 */

Template.on('beforeRemove', function(next){
    var template = this;
    
    Model('CmsDocument').collection().find({ $or:[{ template:template.id },{ contTemplates:template.id }] }).one(function(err, doc){
        if(err) next(err);
        else if(doc) next(new Error('Cannot remove template, one or more documents are using it').details({ code:'EXECFAIL' }));
        else next();
    });
});

Template.on('afterRemove', function(args, next){
    var template = this;
    
    template.constructor.collection().findId(template.id+'.json').remove(function(err){
        template.constructor.collection().findId(template.id+'.js').remove(function(err){
            next();
        });
    });
});