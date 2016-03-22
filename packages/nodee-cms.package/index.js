'use strict';

var util = require('util'),
    Model = require('nodee-model'),
    viewEngine = require('nodee-view'),
    eUtils = require('nodee-utils'),
    utils = framework_utils,
    async = eUtils.async,
    object = eUtils.object,
    fs = require('fs');

/*
 * Require all models
 */
require('./models/CmsImage.js');
require('./models/CmsTemplate.js');
require('./models/CmsPublicFile.js');
require('./models/CmsDocument.js');
require('./models/CmsForm.js');

/*
 * Cms module definition
 */

var cms = new Cms();
module.exports.id = 'nodee-cms';
module.exports.name = 'nodee-cms';
module.exports.version = '0.6.1';
module.exports.instance = cms;
module.exports.dependencies = ['nodee-total', 'nodee-admin'];
module.exports.install = install;

/*
 * Cms constructor
 */

function Cms(){
    this.init = function(basePath){
        this.contentEditors = {
            text:{
                template:basePath+'views/cms-editable-text.html',
                name:'text',
                description:'edit inner html as plain text',
                settings:{ placeholder:'' }
            },
            richtext:{
                template:basePath+'views/cms-editable-richtext.html',
                name:'rich text',
                description:'edit inner html as rich text',
                settings:{ wysiwyg:true, markdown:true, html:true, defaultMode:'' }
            },
            repeat:{
                template:basePath+'views/cms-editable-repeat.html',
                name:'repeat',
                description:'repeat and move html element',
                settings:{}
            },
            attrs:{
                template:basePath+'views/cms-editable-attrs.html',
                name:'attributes',
                description:'edit element attributes',
                settings:{ href:{ name:'link', placeholder:'', values:[] } }
            },
            image:{
                template:basePath+'views/cms-editable-image.html',
                name:'image',
                description:'edit image src',
                settings:{ width:0, widthAuto:false, height:0, heightAuto:false, crop:false, bg_color:'', attr:'src', valueAsId:false }
            }
        };

        this.attributeEditors = {
            text:{
                template:basePath+'views/cms-attribute-text.html',
                name:'text',
                description:'text input',
                settings:{ value:'', minLength:null, maxLength:null, required:false, isList:false, placeholder:'' }
            },
            textarea:{
                template:basePath+'views/cms-attribute-textarea.html',
                name:'text area',
                description:'textarea input',
                settings:{ value:'', minLength:null, maxLength:null, required:false, placeholder:'' }
            },
            number:{
                template:basePath+'views/cms-attribute-number.html',
                name:'number',
                description:'number input',
                settings:{ value:0, min:null, max:null, required:false, placeholder:'' }
            },
            checkbox:{
                template:basePath+'views/cms-attribute-checkbox.html',
                name:'checkbox',
                description:'checkbox input',
                settings:{ value:false }
            },
            image:{
                template:basePath+'views/cms-attribute-image.html',
                name:'image',
                description:'image input, data is image src',
                settings:{ value:'', height:100, autoHeight:false, width:100, autoWidth:false, crop:true, required:false, bg_color: '', valueAsId:false }
            },
            //dateTime:{
            //    template:basePath+'views/cms-attribute-datetime.html',
            //    name:'image',
            //    description:'image input, data is image src',
            //    settings:{ height:200, width:200, mode:'resize', value:null, required:false }
            //},
            //date:{
            //    template:basePath+'views/cms-attribute-date.html',
            //    name:'image',
            //    description:'image input, data is image src',
            //    settings:{ height:200, width:200, mode:'resize', value:null, required:false }
            //},
            //time:{
            //    template:basePath+'views/cms-attribute-time.html',
            //    name:'image',
            //    description:'image input, data is image src',
            //    settings:{ height:200, width:200, mode:'resize', value:null, required:false }
            //}
        };

        this.forms = {
            sanitizers:{
                _none:{ name:'(none)' },
                parseDate:{ id:'parseDate', optsType:'text', defaultValue:'', name:'Date Parse', placeholder:'empty or YYYY-MM-dd...' }, // (value, formatString) check if value is Date, if not, try to parse date defined by formatString
                toDateString: { id:'toDateString', optsType:'text', name:'Date To String', placeholder:'empty or YYYY-MM-dd...' }, // (value, formatString) check if value is Date, and converts it to formated date string
                toString: { id:'toString', optsType:'bool', name:'To String' }, // (input) - convert the input to a string.
                toFloat: { id:'toFloat', optsType:'bool', name:'To Float' }, // (input) - convert the input to a float, or NaN if the input is not a float.
                toInteger: { id:'toInteger', optsType:'bool', name:'To Integer' }, // (input [, radix]) - convert the input to an integer, or NaN if the input is not an integer.
                toBoolean: { id:'toBoolean', optsType:'bool', name:'To Boolean' }, // (input [, strict]) - convert the input to a boolean. Everything except for '0', 'false' and '' returns true. In strict mode only '1' and 'true' return true.
                trim: { id:'trim', optsType:'bool', name:'Trim whitespaces' }, // (input [, chars]) - trim characters (whitespace by default) from both sides of the input.
                ltrim: { id:'ltrim', optsType:'bool', name:'Trim Left whitespaces' }, // (input [, chars]) - trim characters from the left-side of the input.
                rtrim: { id:'rtrim', optsType:'bool', name:'Trim Right whitespaces' }, // (input [, chars]) - trim characters from the right-side of the input.
                escape: { id:'escape', optsType:'bool', name:'Escape <,>,&,\'," with HTML entities' }, // (input) - replace <, >, &, ' and " with HTML entities.
            },
            validators:{
                _none:{ name:'(none)' },
                isInteger:{ id:'isInteger', optsType:'bool', type:'text', name:'Integer' }, // alias for isInt
                isString: { id:'isString', optsType:'bool', type:'text', name:'String' }, // check if value is string
                isArray: { id:'isArray', optsType:'bool', type:'list', name:'String Array' }, // check if value is array
                isBoolean: { id:'isBoolean', optsType:'bool', type:'bool', name:'Boolean' }, // check if value is boolean
                isEmail: { id:'isEmail', optsType:'bool', type:'text', name:'Email' }, // (str) - check if the string is an email.
                isURL: { id:'isURL', optsType:'bool', type:'text', name:'URL' }, // (str [, options]) - check if the string is an URL. options is an object which defaults to { protocols: ['http','https','ftp'], require_tld: true, require_protocol: false, allow_underscores: false, host_whitelist: false, host_blacklist: false }.
                isFQDN: { id:'isFQDN', optsType:'bool', type:'text', name:'FQDN' }, // (str [, options]) - check if the string is a fully qualified domain name (e.g. domain.com). options is an object which defaults to { require_tld: true, allow_underscores: false }.
                isIP: { id:'isIP', optsType:'bool', type:'text', name:'IP' }, // (str [, version]) - check if the string is an IP (version 4 or 6).
                isAlpha: { id:'isAlpha', optsType:'bool', type:'text', name:'Alphabet' }, // (str) - check if the string contains only letters (a-zA-Z).
                isNumeric: { id:'isNumeric', optsType:'bool', type:'number', name:'Numeric' }, // (str) - check if the string contains only numbers.
                isAlphanumeric: { id:'isAlphanumeric', optsType:'bool', type:'text', name:'Alpha-Numeric' }, // (str) - check if the string contains only letters and numbers.
                isBase64: { id:'isBase64', optsType:'bool', type:'text', name:'Base64 String' }, // (str) - check if a string is base64 encoded.
                isHexadecimal: { id:'isHexadecimal', optsType:'bool', type:'text', name:'Hexadecimal String' }, // (str) - check if the string is a hexadecimal number.
                isHexColor: { id:'isHexColor', optsType:'bool', type:'text', name:'Hex Color' }, // (str) - check if the string is a hexadecimal color.
                isFloat: { id:'isFloat', optsType:'bool', type:'number', name:'Float' }, // (str) - check if the string is a float.
                isUUID: { id:'isUUID', optsType:'bool', type:'text', name:'UUID' }, // (str [, version]) - check if the string is a UUID (version 3, 4 or 5).
                isDate: { id:'isDate', optsType:'bool', type:'date', name:'Date' }, // (str) - check if the string is a date.
                isCreditCard: { id:'isCreditCard', optsType:'bool', type:'text', name:'Credit Card' }, // (str) - check if the string is a credit card.
                isISBN: { id:'isISBN', optsType:'bool', type:'text', name:'ISBN' }, // (str [, version]) - check if the string is an ISBN (version 10 or 13).
                isJSON: { id:'isJSON', optsType:'bool', type:'text', name:'JSON String' }, // (str) - check if the string is valid JSON (note: uses JSON.parse).
                isIn: { id:'isIn', optsType:'list', type:'list', name:'In String Values' }, // check if value is in a array of allowed values
                isAfter: { id:'isAfter', optsType:'date', type:'date', name:'After Date' }, // (str [, date]) - check if the string is a date that's after the specified date (defaults to now).
            isBefore: { id:'isBefore', optsType:'date', type:'date', name:'Before Date' }, // (str [, date]) - check if the string is a date that's before the specified date.
            }
        };
    };
    
    return this;
}

function templateBaseProp(templateId){
    return templateId.replace(new RegExp('^'+(viewEngine.viewDirId +'/').escape(),'g'), '').replace(/^widgets\//,'').replace(/\.html$/,'').replace(/\//g,'_');
}

Cms.prototype.view = function(ctrl, document, cb){ // cb(err, html)
    if(arguments.length===1) throw new Error('Wrong arguments');
    if(arguments.length===2 && typeof arguments[1] === 'function'){
        cb = arguments[1];
        document = arguments[0];
        ctrl = {};
    }
    
    if(typeof document === 'string') Model('CmsDocument').collection().findId(document).one(function(err, document){
        if(err) cb(err);
        else view(ctrl, document.template, document, cb);
    });
    else view(ctrl, document.template, document, cb);
};

function view(ctrl, viewName, model, cb){ // cb(err, html)
    var mode = model.$viewMode || model._viewMode || '';
    
    // 1. get all controllers, sort it by priority, and run every one - get final view model
    // 2. generate widgets content
    // 3. generate view 
    
    ctrl.log = function(){
        if(model.$log === undefined) model.addHiddenProperty('$log','');
        model.$log += '<div style="margin:0;padding:0;border:0;color:#000;font-size:100%;font-family:\'Times New Roman\',Times,serif;word-wrap:break-word;"><strong>'+
                        this.viewId+
                        (this.containerId?'-->'+this.containerId:'')+
                        (this.widgetId?'-->'+this.widgetId:'')+':</strong>&nbsp;&nbsp;';
                        
        for(var i=0;i<arguments.length;i++){
            model.$log += util.inspect(arguments[i], { depth:null })
                .replace(/</g,'&lt;')
                .replace(/>/g,'&gt;')
                .replace(/\n/g,'<br>')
                .replace(/\s/g,'&nbsp;')+
                '&nbsp;&nbsp;';
        }
        model.$log = model.$log + '</div>';
    };
    
    var pageView = viewEngine.getView(viewEngine.viewDirId+'/'+viewName);
    if(!pageView) {
        if(cb) return cb(new Error('Cms: rendering view failed, view "' +viewName+ '" not found'));
        else if(framework.isDebug || mode === 'admin'){
            var value = 'Cms: rendering view failed, view "' +viewName+ '" not found';
            framework.responseContent(ctrl.req, ctrl.res, 500, value, 'text/plain', ctrl.config['allow-gzip']);
            return;
        }
        else throw new Error('Cms: rendering view failed, view "' +viewName+ '" not found');
    }
    var controllers = [], widget, layout = pageView.layout ? viewEngine.getView(viewEngine.viewDirId+'/'+pageView.layout+'.html') : null;
    
    try {
        // get layout controller
        if(layout) {
            if(layout.script) addPrioritySorted(controllers, { script:require(layout.script), name:pageView.layout });
            
            // get layout partials controllers
            for(var p=0;p<layout.partials.length;p++) {
                if((viewEngine.getView(viewEngine.viewDirId+'/'+layout.partials[p].template+'.html')||{}).script) {
                    addPrioritySorted(controllers, {
                        script: require(viewEngine.getView(viewEngine.viewDirId+'/'+layout.partials[p].template+'.html').script),
                        name: layout.partials[p].template,
                        containerId: layout.partials[p].containerId,
                        widgetId: layout.partials[p].widgetId
                    });
                }
            }
        }
        
        // register page controller
        if(pageView.script) addPrioritySorted(controllers, { script:require(pageView.script), name:viewName });
        
        // get static widgets (partials) controllers
        for(var p=0;p<pageView.partials.length;p++) {
            if((viewEngine.getView(viewEngine.viewDirId+'/'+pageView.partials[p].template+'.html')||{}).script) {
                addPrioritySorted(controllers, {
                    script: require(viewEngine.getView(viewEngine.viewDirId+'/'+pageView.partials[p].template+'.html').script),
                    name: pageView.partials[p].template,
                    containerId: pageView.partials[p].containerId,
                    widgetId: pageView.partials[p].widgetId
                });
            }
        }
        
        // document containers example
        // containers = { left:[ { template:'widgets/menu.html', id:'menu' },{ template:'widgets/menu.html', id:'menu_1' } ] }
        
        // get content widgets controllers
        for(var cId in (model.containers||{})){
            for(var w=0;w<model.containers[cId].length;w++) {
                widget = viewEngine.getView( viewEngine.viewDirId+'/'+ model.containers[cId][w].template );
                if((widget||{}).script) addPrioritySorted(controllers, {
                    script: require((widget||{}).script),
                    name: model.containers[cId][w].template,
                    containerId: cId,
                    widgetId: model.containers[cId][w].id
                });
            }
        }
    }
    catch(err){
        if(cb) cb(new Error('Cms: rendering view failed').cause(err));
        else if(framework.isDebug || mode === 'admin'){
            var value = 'Cms - rendering view failed: ' + err.message + '\n\n' + err.stack + '\n\n';
            for(var prop in err) if(err.hasOwnProperty(prop)) value += prop + ': ' + err[prop] + '\n';
            framework.responseContent(ctrl.req, ctrl.res, 500, value, 'text/plain', ctrl.config['allow-gzip']);
        }
        else if(ctrl.view500) ctrl.view500(new Error('Cms: rendering view failed').cause(err));
        else throw new Error('Cms: rendering view failed').cause(err);
    }
    
    // run all controllers in sorted order
    async.Series.each(controllers, function(i, next){
        var cms_ctrl = controllers[i].script.controller || controllers[i].script.ctrl || controllers[i].script.view;
        
        ctrl.viewId = controllers[i].name||'';
        ctrl.widgetId = controllers[i].widgetId||'';
        ctrl.containerId = controllers[i].containerId||'';
        
        if(cms_ctrl && typeof cms_ctrl !== 'function') next(new Error('Cms render view: Cannot run cms controller '+
                                                                      'for template "' +controllers[i].name+ '" in widget "'+controllers[i].widgetId+'", it is not function'));
        else if(cms_ctrl) {
            try { cms_ctrl.call(ctrl, model, next); }
            catch(err){ next(err); }
        }
        else next();
        
    }, function(err){
        
        if(err) {
            if(cb) return cb(new Error('Cms: executing controller "' +ctrl.viewId+ '" for widget "' +ctrl.widgetId+ '" in container "' +ctrl.containerId+ '" failed').cause(err));
            else if(framework.isDebug || mode === 'admin'){
                var value = 'Cms: executing controller "' +ctrl.viewId+ '" for widget "' +ctrl.widgetId+ '" in container "' +ctrl.containerId+ '" failed ' + err.message + '\n\n' + err.stack + '\n\n';
                for(var prop in err) if(err.hasOwnProperty(prop)) value += prop + ': ' + err[prop] + '\n';
                framework.responseContent(ctrl.req, ctrl.res, 500, value, 'text/plain', ctrl.config['allow-gzip']);
            }
            else if(ctrl.view500) ctrl.view500(new Error('Cms: executing controller "' +ctrl.viewId+ '" for widget "' +ctrl.widgetId+ '" in container "' +ctrl.containerId+ '" failed').cause(err));
            else throw new Error('Cms: executing controller "' +ctrl.viewId+ '" for widget "' +ctrl.widgetId+ '" in container "' +ctrl.containerId+ '" failed').cause(err);
        }
        else { // view cms page
            
            // delete temporary props
            delete ctrl.viewId;
            delete ctrl.widgetId;
            delete ctrl.containerId;
            
            // render all wingets in all containers
            var containers = {};
            for(var cId in (model.containers||{})){
                containers[cId] = '';
                for(var w=0;w<model.containers[cId].length;w++) {
                    widget = viewEngine.getView( viewEngine.viewDirId+'/'+ model.containers[cId][w].template );
                    if(widget) {
                        try {
                            var dynamicKeys = {};
                            if(widget.mapping) dynamicKeys[ widget.mapping.baseProp ] = cId+'.'+model.containers[cId][w].id;
                            containers[cId] += widget(model, mode, '', [], [], model.containers[cId][w].id, dynamicKeys); // (model, mode, body, partials, containers, widgetId, dynamicKeys)
                        }
                        catch(err){
                            if(cb) return cb(new Error('Cms: rendering widget "' +model.containers[cId][w].id+ '" in container "' +cId+ '" failed').cause(err));
                            else if(framework.isDebug || mode === 'admin'){
                                var value = 'Cms: rendering widget "' +model.containers[cId][w].id+ '" in container "' +cId+ '" failed ' + err.message + '\n\n' + err.stack + '\n\n';
                                for(var prop in err) if(err.hasOwnProperty(prop)) value += prop + ': ' + err[prop] + '\n';
                                framework.responseContent(ctrl.req, ctrl.res, 500, value, 'text/plain', ctrl.config['allow-gzip']);
                            }
                            else if(ctrl.view500) ctrl.view500(new Error('Cms: rendering widget "' +model.containers[cId][w].id+ '" in container "' +cId+ '" failed').cause(err));
                            else throw new Error('Cms: rendering widget "' +model.containers[cId][w].id+ '" in container "' +cId+ '" failed').cause(err);
                        }
                    }
                }
            }
            
            if(cb) {
                if(ctrl.view) cb(null, ctrl.view('ne:'+model.template, model, true, containers));
                else cb(null, framework.view('ne:'+model.template, model, true, containers));
            }
            else ctrl.view('ne:'+model.template, model, false, containers);
        }
    });
}

function addPrioritySorted(array, element){
    element.priorityOrder = element.priorityOrder || 0;
    array._min = array._min || 0;
    array._max = array._max || 0;
    
    if(!array.length || element.priorityOrder >= array._min) {
        array.push(element);
        array._max = element.priorityOrder;
    }
    else if(element.priorityOrder <= array._min) {
        array.unshift(element);
        array._min = element.priorityOrder;
    }
    else for(var i=0;i<array.length;i++){
        if(array[i].priorityOrder <= element.priorityOrder && (array[i+1]||{}).priorityOrder >= element.priorityOrder) {
            array.splice(i+1, 0, element);
            break;
        }
        if(i===array.length-1) {
            array.push(element);
            break;
        }
    }
    
    return array;
}

/**
 * Cms router
 * @param {Object} extendModel optional extends document model
 */
Cms.prototype.router = function(extendModel){
    var ctrl = this, admin = MODULE('nodee-admin');
    
    // params = Array.prototype.slice.call(arguments, 0);
    // console.warn(ctrl.uri);
    //{   protocol: 'http:',
    //    slashes: true,
    //    auth: null,
    //    host: '127.0.0.1',
    //    port: null,
    //    hostname: '127.0.0.1',
    //    hash: null,
    //    search: '?asd=ds',
    //    query: 'asd=ds',
    //    pathname: '/content',
    //    path: '/content?asd=ds',
    //    href: 'http://127.0.0.1/content?asd=ds' }
    
    // e.g. //127.0.0.1/content
    var pathName = ctrl.uri.pathname.replace(/\/$/g, ''); // replace last "/";
    
    var cmsRoutes = admin.config.get('cmsroutes') || [];
    var params = {}, vars;
    if(!ctrl.search404) for(var i=0;i<cmsRoutes.length;i++){
        vars = pathName.match(new RegExp(cmsRoutes[i].regex));
        if(vars){ // path matched, fill vars
            vars.shift(); // remove first matched element
            for(var v=0;v<vars.length;v++) params[ cmsRoutes[i].vars[v] ] = vars[v];
            pathName = cmsRoutes[i].target;
            break;
        }
    }
    
    var urlPath = ctrl.search404 || ('//' + ctrl.uri.hostname + pathName);
    ctrl.params = params;
    
    // check if document exists
    Model('CmsDocument').collection().cache().find({ url: urlPath }).one(function(err, doc){
        if(err) ctrl.view500(err);
        else if(!doc || !doc.published) {
            if(ctrl.search404) ctrl.view404(); // route, include route to 404, not found, let app handle 404
            else {
                ctrl.search404 = '//' + ctrl.uri.hostname + '/404';
                cms.router.call(ctrl);
            }
        }
        else if(doc.requireSSL && !ctrl.isSecure){ // redirect to secured protocol
            ctrl.redirect(ctrl.uri.href.replace(/^(http)/,'https'));
        }
        //else if(doc.internalRedirect){ // run internal redirect
        //    cms.router.apply(ctrl, params);
        //}
        else { // route found, check roles
            
            // extend model if it is defined
            if(extendModel && object.isObject(extendModel)) object.extend(true, doc, extendModel);
            
            if((doc.denyRoles.length || doc.allowRoles.length) && !ctrl.user){
                // unauthorized request, let app handle 403
                ctrl.view403();
            }
            else if((doc.denyRoles.length || doc.allowRoles.length) && ctrl.user){
                // authorized request, check roles
                for(var i=0;i<doc.denyRoles.length;i++){
                    if((ctrl.user.roles || []).indexOf(doc.denyRoles[i])){
                        ctrl.view403(); // user has one of disabled roles, let app handle 403
                        return;
                    }
                }
                for(var i=0;i<doc.allowRoles.length;i++){
                    if((ctrl.user.roles || []).indexOf(doc.allowRoles[i])){
                        cms.view(ctrl, doc); // user has one of allowed roles, continue routing
                        return;
                    }
                }
                ctrl.view403(); // user has none of allowed roles, let app handle 403
            }
            else cms.view(ctrl, doc);
        }
    });
};

Cms.prototype.sendMail =
Cms.prototype.mail = function(to, subject, document, bracketsData, cb){ // cb(err)
    var cms = this;
    if(arguments.length===4 && typeof arguments[3] === 'function'){
        cb = arguments[3];
        bracketsData = null;
    }
    
    if(typeof document === 'string') Model('CmsDocument').collection().findId(document).one(function(err, document){
        if(err && cb) cb(err);
        else if(err) throw err;
        else if(!document && cb) cb(new Error('Cms.prototype.sendMail: CmsDocument NOTFOUND').details({ code:'NOTFOUND' }));
        else if(!document) throw new Error('Cms.prototype.sendMail: CmsDocument NOTFOUND').details({ code:'NOTFOUND' })
        else {
            if(bracketsData) document.$brackets = bracketsData;
            cms.view(document, function(err, html){
                if(err && cb) cb(err);
                else if(err) throw err;
                else framework.sendMail({
                    to: to,
                    subject: subject,
                    model: document,
                    body: html
                }, cb);
            });
        }
    });
    else {
        if(bracketsData) document.$brackets = bracketsData;
        cms.view(document, function(err, html){
            if(err && cb) cb(err);
            else if(err) throw err;
            else framework.sendMail({
                to: to,
                subject: subject,
                model: document,
                body: html
            }, cb);
        });
    }
}

function install(){
    
    var admin = MODULE('nodee-admin');
    var basePath = admin.basePath;
    cms.init(basePath);
    
    admin.languageMerge('sk-sk', require('./languages/sk-sk.js'));
    
    // register cms router
    framework.route('/*', cms.router, ['get']);
    framework.route('/*', function(){
        var ctrl = this;
        var formId = ctrl.query.cmsform || ctrl.query.formId || ctrl.body.cmsform || ctrl.body.formId;
        if(formId) createEntry.call(ctrl, formId);
        else cms.router.call(ctrl);
    }, ['post','body2object']);
    
    // framework.route('#403', cms.route403);
    // framework.route('#404', cms.route404);
    // framework.route('#500', cms.route500);
    
    var CmsRoute = Model.define({
        template:{ required:true, isString:true }, // e.g. /products/{id}-{name}
        target:{ required:true, isString:true }, // e.g. /product-page
        regex:{}, // will be generated on fill
        vars:{}, // will be generated on fill
        description:{ isString:true }
    });
    
    CmsRoute.onValidate(function(model){
        model.target = model.target.replace(/\/$/g, ''); // replace last "/"
        if(model.target[0]!=='/') model.target = '/'+model.target; // add fitst "/"
        
        model.template = model.template.replace(/\/$/g, ''); // replace last "/"
        if(model.template[0]!=='/') model.template = '/'+model.template;  // add fitst "/"
        
        model.vars = model.template.match(/(\{[^\}^\{]+\})/g) || [];
        if(model.vars.length) {
            for(var v=0;v<model.vars.length;v++) model.vars[v] = model.vars[v].substring(1, model.vars[v].length-1);
        }
        model.regex = '^'+ model.template
                           .replace(/[\-\[\]\/\(\)\+\?\.\\\^\$\|]/g, '\\$&') // escape all, but "{", "}", and "*"
                           .replace(/(\{[^\}^\{]+\})/g,'([^\\/]+)') // replace {paramName}
                           .replace(/\{/g,'\\{') // escape "{"
                           .replace(/\}/g,'\\}') // escape "}"
                           .replace(/\*/g,'.*') + // replace "*"
			   '$'; // add regex end of string at the end
    });
    
    // Cms route templates can be defined in admin
    admin.config.items.cmsroutes = {
        name: 'Cms Routes',
        description: 'Dynamic Routing bsed on Path Parameters like "/products/{productId}/*"',
        templateUrl: 'views/cms-config-routes.html',
        icon: 'fa-exchange',
        array: true, // will be validated as array of Models
        keyValue: false, // will be validated as key - Model
        defaultValue:[],
        Model: CmsRoute
    };
    
    // replace admin theme by cms-theme
    admin.styles.splice(admin.styles.indexOf(basePath+'theme/ne-theme.css'), 1, basePath+'theme/cms-theme.css');
    admin.styles.push(basePath+'theme/cms-theme-customs.css');
    
    // cms editors uses jquery to manipulate DOM
    admin.libs.unshift(framework.isDebug ? '/3rd-party/jquery/jquery.js' : '//ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js');
    
    // add global cms attribute editors
    admin.globals.cmsAttributeEditors = cms.attributeEditors;
    admin.globals.cmsContentEditors = cms.contentEditors;
    
    admin.menu.append({
        id:'cms-documents',
        name:'Website Structure',
        allowRoles:['admin','cms','cmscontent'],
        // denyRoles:['admin','cms'],
        icon:'fa fa-fw fa-sitemap', href:'#/cms/documents'
    });
    admin.menu.append({
        id:'cms-images',
        name:'Images',
        allowRoles:['admin','cms'],
        // denyRoles:['admin','cms'],
        icon:'fa fa-fw fa-image', href:'#/cms/images'
    });
    admin.menu.append({
        id:'cms-files',
        name:'Public Files (css,js,...)',
        allowRoles:['admin','cms','cms_files'],
        // denyRoles:['admin','cms'],
        icon:'fa fa-fw fa-folder-open', href:'#/cms/files'
    });
    admin.menu.append({
        id:'cms-templates',
        name:'Templates And Widgets',
        allowRoles:['admin','cms'],
        // denyRoles:['admin','cms'],
        icon:'fa fa-fw fa-code', href:'#/cms/templates'
    });
    admin.menu.append({
        id:'cms-forms',
        name:'Forms',
        allowRoles:['admin','cms'],
        // denyRoles:['admin','cms'],
        icon:'fa fa-fw fa-list-alt', href:'#/cms/forms'
    });
    
    
    // admin javascripts
    framework.merge(basePath+'ne-admin-cms.js',
                    '@nodee-cms/app/ne-admin-cms.js',
                    '@nodee-cms/app/angular-editable/ne-editable.js',
                    '@nodee-cms/app/angular-editable/ne-editable-attr.js',
                    '@nodee-cms/app/angular-editable/ne-editable-text.js',
                    '@nodee-cms/app/angular-editable/ne-editable-container.js',
                    '@nodee-cms/app/angular-editable/ne-editable-image.js');
    
    // 3rd-party scripts
    framework.mapping('/3rd-party/jquery/', '@nodee-cms/app/3rd-party/jquery');
    framework.mapping('/3rd-party/ace/', '@nodee-cms/app/3rd-party/ace');
    
    framework.mapping(basePath+'angular-editable/ui-ace.js', '@nodee-cms/app/angular-editable/ui-ace.js');
    
    // admin views
    framework.mapping(basePath+'views/cms-config-routes.html', '@nodee-cms/app/views/cms-config-routes.html');
    
    framework.mapping(basePath+'views/cms-attribute-checkbox.html', '@nodee-cms/app/views/cms-attribute-checkbox.html');
    framework.mapping(basePath+'views/cms-attribute-image.html', '@nodee-cms/app/views/cms-attribute-image.html');
    framework.mapping(basePath+'views/cms-attribute-number.html', '@nodee-cms/app/views/cms-attribute-number.html');
    framework.mapping(basePath+'views/cms-attribute-text.html', '@nodee-cms/app/views/cms-attribute-text.html');
    framework.mapping(basePath+'views/cms-attribute-textarea.html', '@nodee-cms/app/views/cms-attribute-textarea.html');
    framework.mapping(basePath+'views/cms-attributes-modal.html', '@nodee-cms/app/views/cms-attributes-modal.html');
    
    framework.mapping(basePath+'views/cms-documents.html', '@nodee-cms/app/views/cms-documents.html');
    framework.mapping(basePath+'views/cms-documents-create.html', '@nodee-cms/app/views/cms-documents-create.html');
    framework.mapping(basePath+'views/cms-documents-details.html', '@nodee-cms/app/views/cms-documents-details.html');
    framework.mapping(basePath+'views/cms-documents-security.html', '@nodee-cms/app/views/cms-documents-security.html');
    framework.mapping(basePath+'views/cms-documents-tempsettings.html', '@nodee-cms/app/views/cms-documents-tempsettings.html');
    
    framework.mapping(basePath+'views/cms-editable-attrs.html', '@nodee-cms/app/views/cms-editable-attrs.html');
    framework.mapping(basePath+'views/cms-editable-repeat.html', '@nodee-cms/app/views/cms-editable-repeat.html');
    framework.mapping(basePath+'views/cms-editable-default.html', '@nodee-cms/app/views/cms-editable-default.html');
    framework.mapping(basePath+'views/cms-editable-image.html', '@nodee-cms/app/views/cms-editable-image.html');
    framework.mapping(basePath+'views/cms-editable-richtext.html', '@nodee-cms/app/views/cms-editable-richtext.html');
    framework.mapping(basePath+'views/cms-editable-richtext-link.html', '@nodee-cms/app/views/cms-editable-richtext-link.html');
    framework.mapping(basePath+'views/cms-editable-richtext-table.html', '@nodee-cms/app/views/cms-editable-richtext-table.html');
    framework.mapping(basePath+'views/cms-editable-text.html', '@nodee-cms/app/views/cms-editable-text.html');
    
    framework.mapping(basePath+'views/cms-files.html', '@nodee-cms/app/views/cms-files.html');
    framework.mapping(basePath+'views/cms-files-create.html', '@nodee-cms/app/views/cms-files-create.html');
    framework.mapping(basePath+'views/cms-files-edit.html', '@nodee-cms/app/views/cms-files-edit.html');
    
    framework.mapping(basePath+'views/cms-images.html', '@nodee-cms/app/views/cms-images.html');
    framework.mapping(basePath+'views/cms-images-document-item.html', '@nodee-cms/app/views/cms-images-document-item.html');
    framework.mapping(basePath+'views/cms-images-modal.html', '@nodee-cms/app/views/cms-images-modal.html');
    
    framework.mapping(basePath+'views/cms-templates.html', '@nodee-cms/app/views/cms-templates.html');
    framework.mapping(basePath+'views/cms-templates-create.html', '@nodee-cms/app/views/cms-templates-create.html');
    
    framework.mapping(basePath+'views/cms-forms.html', '@nodee-cms/app/views/cms-forms.html');
    framework.mapping(basePath+'views/cms-forms-create.html', '@nodee-cms/app/views/cms-forms-create.html');
    
    framework.mapping(basePath+'views/cms-widgets-create.html', '@nodee-cms/app/views/cms-widgets-create.html');
    
    // cms admin style
    framework.mapping(basePath+'theme/cms-theme.css', '@nodee-cms/app/theme/cms-theme.css');
    framework.mapping(basePath+'theme/cms-theme-customs.css', '@nodee-cms/app/theme/cms-theme-customs.css');
    framework.mapping(basePath+'images/favicon.ico', '@nodee-cms/app/images/favicon.ico');
    
    
    /*
     * CMS DOCUMENTS
     */
    
    // admin routes
    admin.routes[ '/cms/documents' ] = {
        templateUrl: 'views/cms-documents.html',
        controller:'CmsDocumentsCtrl',
        // reloadOnSearch:false,
        load:{ name:'neAdmin.cms', files:[basePath+'ne-admin-cms.js'] }
    };
    
    framework.rest(basePath+'cms/documents', 'CmsDocument', [
        { route:'/', collection:'all', flags:[ 'get' ], count:true },
        { route:'/exists', collection:'exists', flags:['get'] },
        { route:'/{id}', collection:'one', flags:[ 'get' ] },
        { route:'/', instance:'create', before:disableSort, flags:[ 'post', 'json' ] },
        //{ route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'update', before:disableSort, flags:[ 'put', 'json' ] }, // TODO: dont allow update templateSettings to non admin users
        { route:'/{id}', instance:'remove', flags:[ 'delete' ] },
        
        // change sortOrder position
        { route:'/{id}/position', instance:'update', flags:[ 'put', 'json' ] }
        
    ], ['authorize','!admin','!cms','!cmscontent']);
    
    function disableSort(ctx, next){
        delete ctx.body.sortOrder;
        next();
    }
    
    framework.route(basePath+'cms/documents/{id}/render', renderPage, ['get','authorize','!admin','!cms','!cmscontent']);
    function renderPage(id){
        var ctrl = this;
        Model('CmsDocument').collection().findId(id).one(function(err, doc){
            if(err) ctrl.view500(err);
            else if(!doc) ctrl.view404();
            else {
                doc.$viewMode = 'admin';
                cms.view(ctrl, doc);
            }
        });
    }
    
    framework.route(basePath+'cms/documents/{id}/content', updateContent, ['post','json','authorize','!admin','!cms','!cmscontent'], 1000); // 1 000 kB
    function updateContent(id){
        var ctrl = this;
        
        var html = ctrl.body.html;
        var attributes = ctrl.body.attributes;
        var modifiedDT = ctrl.body.modifiedDT;
        
        Model('CmsDocument').collection().findId(id).one(function(err, doc){
            if(err) ctrl.view500(err);
            else if(!doc) ctrl.view404();
            else {
                // parse html & update document content
                if(html){ 
                    // get all "e-template-id"
                    var templates = viewEngine.slice(html);
                    var parsedModel = {}, containers = {}, contWidgetIds = {}, contTemplates = [];
                    
                    async.Series.each(templates, function(i, next){
                        var view = viewEngine.getView(viewEngine.viewDirId+'/'+templates[i].template),
                            mapping = (view||{}).mapping,
                            baseKey = (templates[i].containerId ? templates[i].containerId+'.' :'') + templates[i].widgetId,
                            dynamicKeys = {},
                            parser = null,
                            parseMap = mapping.parse || mapping.view;
                        
                        try {
                            if(view.script) {
                                parser = require(view.script);
                                parser = parser.parse || parser.parser || null;
                            }
                        }
                        catch(err){
                            return next(new Error('Cms: parsing failed').cause(err));
                        }
                        
                        if(baseKey){
                            // widgets/menu.html -> menu
                            dynamicKeys[ mapping.baseProp || templateBaseProp(templates[i].template) ] = baseKey;
                        }
                        
                        // skip if widget is in container but does not have an id
                        if(templates[i].containerId && !templates[i].widgetId) return next();
                        else if(templates[i].containerId){
                            containers[ templates[i].containerId ] = containers[ templates[i].containerId ] || [];
                            if(!contWidgetIds[ templates[i].containerId+templates[i].widgetId ]){ // avoid duplicities, when widget has more root html elements
                                containers[ templates[i].containerId ].push({ id:templates[i].widgetId, template:templates[i].template });
                                contWidgetIds[ templates[i].containerId+templates[i].widgetId ] = true;
                                if(contTemplates.indexOf(templates[i].template)===-1) contTemplates.push(templates[i].template);
                            }
                        }
                        
                        if(parseMap){
                            viewEngine.parse(templates[i].html, parseMap, { dynamicKeys:dynamicKeys }, function(err, model){
                                parsedModel = object.extend(true, parsedModel, model);
                                execParser(parser, doc, templates[i], parsedModel, next);
                            });
                        }
                        else execParser(parser, doc, templates[i], parsedModel, next);
                        
                    }, function(err){
                        if(err) framework.rest.handleResponse(ctrl)(err);
                        else {
                            if(attributes) doc.attributes = attributes;
                            doc.content = parsedModel.content || {};
                            doc.containers = containers;
                            doc.contTemplates = contTemplates;
                            doc.modifiedDT = modifiedDT;
                            doc.update(framework.rest.handleResponse(ctrl));
                        }
                    });
                }
                else {
                    if(attributes) doc.attributes = attributes;
                    doc.modifiedDT = modifiedDT;
                    doc.update(framework.rest.handleResponse(ctrl));
                }
            }
        });
    }
    
    function execParser(parser, document, template, data, next){
        if(parser){
            try {
                parser.call({
                    template: template.template,
                    containerId: template.containerId,
                    widgetId: template.widgetId
                }, data, document, next);
            }
            catch(err){
                next(new Error('Cms: parsing template "'+template.template+'" of widget "'+template.widgetId+'" in container "'+template.containerId+'" failed').cause(err));
            }
        }
        else next();
    }
    
    
    // admin routes
    admin.routes[ '/cms/templates' ] = {
        templateUrl: basePath+'views/cms-templates.html',
        controller:'CmsTemplatesCtrl',
        // reloadOnSearch:false,
        load:[{ name:'admin.cms', files:[ basePath+'ne-admin-cms.js']},
              { name:'ui.ace', files:[framework.isDebug ? '/3rd-party/ace/ace.js' : '//cdnjs.cloudflare.com/ajax/libs/ace/1.1.8/ace.js', basePath+'angular-editable/ui-ace.js' ] }]
    };
    
    framework.rest(basePath+'cms/templates', 'CmsTemplate', [
        { route:'/', collection:'all', flags:[ 'get' ], count:true },
        { route:'/exists', collection:'exists', flags:['get'] },
        { route:'/{id}', collection:'one', flags:[ 'get' ] },
        //{ route:'/', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'update', flags:[ 'put', 'json' ] },
        { route:'/{id}', instance:'remove', flags:[ 'delete' ] },
        
        { route:'/{id}/content', instance:'getContent', flags:[ 'get' ] },
        { route:'/{id}/updatecontent', instance:'updateContent', flags:[ 'post', 'json' ] },
        
    ], ['authorize','!admin','!cms']);
    
    framework.route(basePath+'cms/templates/types/{type}', getList, ['get','authorize','!admin','!cms','!cmscontent']);
    function getList(type){
        var self = this;
        
        var views = viewEngine.getViews();
        var list = [];
        
        for(var viewId in views){
            if(viewId.indexOf('/'+type+'/')>-1) {
                list.push({
                    id: viewId.replace(new RegExp('^'+(viewEngine.viewDirId +'/').escape(),'g'), ''),
                    baseProp: (views[viewId].mapping||{}).baseProp || templateBaseProp(viewId),
                    allowedChildTemplates: (views[viewId].mapping||{}).allowedChildTemplates,
                    name: (views[viewId].mapping||{}).name || '',
                    icon: (views[viewId].mapping||{}).icon || '',
                    color: (views[viewId].mapping||{}).color || '',
                    description: (views[viewId].mapping||{}).description || '',
                    //attributes: views[viewId].mapping.attributes || [],
                    //view: views[viewId].mapping.view || {},
                    //editors: views[viewId].mapping.editors || {},
                    //parse: views[viewId].mapping.parse
                });
            }
        }
        
        self.json({ data:list });
    }
    
    framework.route(basePath+'cms/templates/{id}/meta', getMeta, ['get','#restquery','authorize','!admin','!cms','!cmscontent']);
    function getMeta(){
        var self = this;
        
        var id = self.params.id;
        
        var layout,
            body,
            mappings = [],
            tmpIds = {},
            view = viewEngine.getView(viewEngine.viewDirId+'/'+id);
        
        if(!view) {
            self.status = 404;
            return self.json({ data:null });
        }
        
        mappings.push({ id:id, mapping:view.mapping, isWidget:id.indexOf('widgets/')===0 });
        
        // get layout and layout partials meta
        if(view.layout){
            var layoutId = view.layout+(view.layout.match(/\.html$/g) ? '' : '.html');
            layout = viewEngine.getView(viewEngine.viewDirId+'/'+layoutId);
            mappings.push({ id:layoutId, mapping:layout.mapping });
            addPartialsMappings(layout.partials, mappings, tmpIds);
        }
        
        // get partials (widgets) meta
        addPartialsMappings(view.partials, mappings, tmpIds);
        
        var data = {
            layout: layout,
            partials: view.partials,
            //containers: view.containers,
            attributes: (view.mapping||{}).attributes,
            mappings: mappings
        };
        
        if(self.query.$find.includeContent===true){
            Model('CmsTemplate').collection().findId(id).one(function(err, template){
                if(err) self.view500();
                else if(!template){
                    self.status = 404;
                    self.json({ data:null });
                }
                else template.read(function(err, html){
                    if(err) self.view500();
                    else {
                        data.html = html;
                        self.json({ data:data });
                    }
                });
            });
        }
        
        // include templates from inside containers for this document
        else if(self.query.$find.documentId){
            Model('CmsDocument').collection().findId(self.query.$find.documentId).one(function(err, doc){
                if(err) self.view500();
                else if(!doc){
                    self.status = 404;
                    self.json({ data:'Document not found' });
                }
                else {
                    for(var cId in doc.containers){
                        addPartialsMappings(doc.containers[cId], mappings, tmpIds)
                    }
                    
                    data.document = doc;
                    self.json({ data:data });
                }
            });
        }
        
        // just send meta
        else self.json({ data:data });
    }
    
    function addPartialsMappings(partials, mappings, tmpIds){
        tmpIds = tmpIds || {};
        for(var i=0;i<(partials||[]).length;i++){
            var id = partials[i].template+(partials[i].template.match(/\.html$/g) ? '' : '.html');
            var p = viewEngine.getView(viewEngine.viewDirId+'/'+id);
            if(!tmpIds[ id ]) {
                mappings.push({ id:id, mapping:p.mapping, isWidget:true });
                tmpIds[ id ] = true;
            }
        }
        return mappings;
    }
    
    /*
     * CMS FILES
     */
    
    // admin routes
    admin.routes[ '/cms/files' ] = {
        templateUrl: basePath+'views/cms-files.html',
        controller:'CmsFilesCtrl',
        // reloadOnSearch:false
        load:[{ name:'admin.cms', files:[ basePath+'ne-admin-cms.js']},
              { name:'ui.ace', files:[framework.isDebug ? '/3rd-party/ace/ace.js' : '//cdnjs.cloudflare.com/ajax/libs/ace/1.1.8/ace.js', basePath+'angular-editable/ui-ace.js' ] }]
    };
    
    // rest routes
    framework.rest(basePath+'cms/files', 'CmsPublicFile', [
        { route:'/', collection:'all', flags:[ 'get' ], count:true },
        { route:'/exists', collection:'exists', flags:['get'] },
        // { route:'/{id}', collection:'one', flags:[ 'get' ] },
        // { route:'/', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
        //{ route:'/{id}', instance:'update', flags:[ 'put', 'json' ] },
        { route:'/{id}', instance:'remove', flags:[ 'delete' ] },
        
        //{ route:'/{id}/read', instance:'read', flags:['get'] },
        { route:'/{id}/write', instance:'write', flags:['post','raw'], length: 3000 } // 3 000 kB
    ], ['authorize','!admin']);
    
    // read file content
    framework.route(basePath+'cms/files/{id}/read', readFile, ['get','authorize','!admin']);
    function readFile(){
        var ctrl = this;
        
        Model('CmsPublicFile').collection().findId(ctrl.params.id).one(function(err, file){
            if(err) return framework.rest.handleResponse(ctrl)(err);
            if(!file) {
                ctrl.status = 404;
                return ctrl.json({ date:null });
            }
            
            file.read(function(err, content){
                if(err) return framework.rest.handleResponse(ctrl)(err);
                
                ctrl.json({ data:{ content:content, modifiedDT:file.modifiedDT } });
            });
        });
    }
    
    // file upload
    framework.route(basePath+'cms/files', createFile, ['upload','authorize','!admin'], 3000); // 3 000 kB
    function createFile(){
        var ctrl = this;
        if(ctrl.files.length > 0){
            fs.readFile(ctrl.files[0].path, function(err, data){
                var file = Model('CmsPublicFile').new({
                    id: ctrl.body.id,
                    name: ctrl.files[0].filename,
                    ancestors: (ctrl.body.ancestors||'').split(','),
                    content: data,
                    mimeType: ctrl.files[0].type,
                    ext: (ctrl.files[0].filename||'').split('.').pop()
                });
                
                file.validate();
                if(file.isValid()) file.create(framework.rest.handleResponse(ctrl));
                else {
                    ctrl.status = 400;
                    ctrl.json({ data:file.validErrs() });
                }
            });
        }
        else {
            ctrl.status = 400;
            ctrl.json({ data:{ data:['invalid'] } });
        }
    }
    
    /*
     * CMS FORMS
     */
    
    // admin routes
    admin.routes[ '/cms/forms' ] = {
        templateUrl: basePath+'views/cms-forms.html',
        controller:'CmsFormsCtrl',
        // reloadOnSearch:false
        load:[{ name:'admin.cms', files:[ basePath+'ne-admin-cms.js']}]
    };
    
    // ENTRIES rest routes
    framework.rest(basePath+'cms/form_entries', 'CmsFormEntry', [
        { route:'/', collection:'all', flags:[ 'get' ], count:true },
        { route:'/exists', collection:'exists', flags:['get'] },
        { route:'/{id}', collection:'one', flags:[ 'get' ] },
        { route:'/', instance:'create', flags:[ 'post', 'json' ] },
        //{ route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'update', flags:[ 'put', 'json' ] },
        { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
    ], ['authorize','!admin']);
    
    // FORMS rest routes
    framework.rest(basePath+'cms/forms', 'CmsForm', [
        { route:'/', collection:'all', flags:[ 'get' ], count:true },
        { route:'/exists', collection:'exists', flags:['get'] },
        { route:'/{id}', collection:'one', flags:[ 'get' ] },
        // { route:'/', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'update', flags:[ 'put', 'json' ] },
        { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
    ], ['authorize','!admin']);
    
    // publish mailers list from admin.config
    framework.route(basePath+'cms/forms/mailerslist', function(){ this.json({ data: Object.keys(admin.config.get('mailers')||{}) }); }, ['get','authorize','!admin']);
    
    // public form submit as json
    framework.route(basePath+'cms/forms/fieldtypes', function(){ this.json({ data:cms.forms }); }, ['get','authorize','!admin']);
    
    // public form submit as json
    framework.route('/cmsforms/{formId}', createEntry, ['post','json']);
    
    // public form submit as multipart
    framework.route('/cmsforms/{formId}', createEntry, ['post','body2object']);
    
    function createEntry(formId){
        var ctrl = this;
        
        // create and validate entry
        var entry = Model('CmsFormEntry').new({ formId:formId, data:ctrl.body });
        entry.validateData(function(err, entry, form){
            if(err) return handleFormResponse(ctrl,entry,form)(err);
            
            // allow CORS if it is defined
            if(form.allowCors) ctrl.cors(['*']);
            
            if(entry.key){
                Model('CmsFormEntry').collection().find({ formId:formId, key:entry.key }).one(function(err, oldEntry){
                    if(err) return handleFormResponse(ctrl,entry,form)(err);
                    if(oldEntry){
                        
                        // compare entry and oldEntry
                        var compared = {};
                        for(var key in entry.data){
                            if(oldEntry.data.hasOwnProperty(key)) compared[key] = oldEntry.data[key] === entry.data[key] ? null : 'change';
                            else if(entry[key] !== undefined) compared[key] = 'define';
                        }
                        
                        object.extend(true, oldEntry.data, entry.data);
                        oldEntry.update(handleFormResponse(ctrl,entry,form,compared));
                    }
                    else entry.create(handleFormResponse(ctrl,entry,form));
                });
            }
            else entry.create(handleFormResponse(ctrl,entry,form));
        });
    }
    
    function handleFormResponse(ctrl, entry, form, compared){
        return function(err, updatedEntry){
            if(err){
                if(ctrl.flags.indexOf('json')>-1) return framework.rest.handleResponse(ctrl)(err);
                else if(err.code==='INVALID') {
                    ctrl.status = 400;
                    //var refUrl = (ctrl.req.headers['referer'] || '').replace(/^http:/g,'').replace(/^https:/g,'');
                    return cms.router.call(ctrl, { $form:{ data:entry, validErrs:err.validErrs } });
                }
                else return ctrl.view500(err);
            }
            
            function handleMailSent(err){
                Model('CmsFormEntry').collection().findId(updatedEntry.id).update({
                    $push:{
                        logs:{
                            status: err ? 'error' : 'success',
                            event:'email',
                            createdDT: new Date(),
                            error: err ? err.message : null
                        }
                    }
                }, function(err){
                    if(err) console.warn(err);
                });
            }
            
            // send email if needed
            for(var i=0;i<(form.emails||[]).length;i++){
                var email = form.emails[i];
                var propName = email.propName;
                var sendOn = email.sendOn;
                
                if(propName && sendOn && sendOn!=='never'){
                    
                    // check if property defined / changed / always
                    if(sendOn==='always' ||
                       (sendOn==='define' && (!compared || compared[propName]==='define')) ||
                       (sendOn==='change' && compared && compared[propName]==='change')){
                        
                        (function(email){
                            Model('CmsDocument').collection().cache().find({ url: email.documentUrl }).one(function(err, doc){
                                if(err) handleMailSent(err);
                                else if(!doc) handleMailSent(new Error('CmsDocument NOTFOUND').details({ code:'NOTFOUND' }));
                                else {
                                    doc.$brackets = entry.data;
                                    cms.view(doc, function(err, html){
                                        if(err) handleMailSent(err);
                                        else framework.sendMail({
                                            to: eUtils.template.render(email.to||'', entry.data),
                                            cc: eUtils.template.render(email.cc||'', entry.data),
                                            bcc: eUtils.template.render(email.bcc||'', entry.data),
                                            subject: eUtils.template.render(email.subject||'', entry.data),
                                            model: doc,
                                            body: html,
                                            config: (admin.config.get('mailers')||{})[ email.mailer ]
                                            
                                        }, handleMailSent);
                                    });
                                }
                            });
                        })(email);
                    }
                }
            }
            
            // response
            if(ctrl.flags.indexOf('json')>-1) framework.rest.handleResponse(ctrl)(err);
            else if(form.redirect) ctrl.redirect(form.redirect);
            else cms.router.call(ctrl, { $form:{ data:entry.getData(), validErrs:entry.validErrs() } });
        }
    }
    
    
    /*
     * CMS IMAGES
     */
    
    // admin routes
    admin.routes[ '/cms/images' ] = {
        templateUrl: basePath+'views/cms-images.html',
        controller:'CmsImagesCtrl',
        // reloadOnSearch:false
        load:{ name:'admin.cms', files:[basePath+'ne-admin-cms.js'] }
    };
    
    // rest routes
    framework.rest(basePath+'cms/images', 'CmsImage', [
        { route:'/', collection:'all', flags:[ 'get' ], count:true },
        { route:'/exists', collection:'exists', flags:['get'] },
        //{ route:'/{id}', collection:'one', flags:[ 'get' ] },
        { route:'/', instance:'create', flags:[ 'post', 'json' ] },
        { route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
        //{ route:'/{id}', instance:'update', flags:[ 'put', 'json' ] },
        { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
    ], ['authorize','!admin']);
    
    // image upload
    framework.route(basePath+'cms/images', createImage, ['upload'], 3000); // 3 000 kB
    function createImage(){
        var ctrl = this;
        if(ctrl.files.length > 0){
            fs.readFile(ctrl.files[0].path, function(err, data){
                var image = Model('CmsImage').new({
                    name: ctrl.files[0].filename,
                    type: 'original',
                    data: data,
                    height: ctrl.files[0].height,
                    width: ctrl.files[0].width,
                    length: ctrl.files[0].length,
                    mimeType: ctrl.files[0].type,
                    ext: (ctrl.files[0].filename||'').split('.').pop()
                });
                
                if(ctrl.body.document) image.document = ctrl.body.document;
                image.validate();
                if(image.isValid()) image.create(framework.rest.handleResponse(ctrl));
                else {
                    ctrl.status = 400;
                    ctrl.json({ data:image.validErrs() });
                }
            });
        }
        else {
            ctrl.status = 400;
            ctrl.json({ data:{ data:['invalid'] } });
        }
    }
    
    /*
     * Public image
     */
    framework.file('/cmsimages/*.jpg', imageRouter);
    
};

var url = require('url'),
    bufferFromStream = require('nodee-utils').buffer.fromStream;
    
var imagesDir = 'cmsimages',
    imageModelName = 'CmsImage',
    maxW = 2000,
    maxH = 1600,
    maxParallelResizes = 1, // maximum parallel resizes, to prevent high memory and cpu usage
    expireAfterHours = 72, // resized image will expire after 72 hours
    expireRenewHours = 24, // if resized image requested in lower than 24 hours until expiration, expire will be extended
    gravityShorts = {
        topleft:'top left',         tl:'top left',
        top:'top',                  t:'top',
        topright:'top right',       tr:'top right',
        left:'left',                l:'left',
        center:'center',            c:'center',
        right:'right',              r:'right',
        bottomleft:'bottom left',   bl:'bottom left',
        bottom:'bottom',            b:'bottom',
        bottomright:'bottom right', br:'bottom right',
        
        crop:'center', resize:'center'
    };
var emptyPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2BgYGAAAAAFAAGKM+MAAAAAAElFTkSuQmCC';

// /cmsimages/:id.:extension - generated by Path-to-RegExp module
var pathRgx = new RegExp('^\/'+imagesDir.escape()+'\/(?:([^\/]+?))(?:\.([^\/\.]+?))\/?$','i');
// /cmsimages/:id/:whc.:extension - generated by Path-to-RegExp module
var pathRgx_whc = new RegExp('^\/'+imagesDir.escape()+'\/(?:([^\/]+?))\/(?:([^\/]+?))(?:\.([^\/\.]+?))\/?$', 'i');


function imageError(err, req, res){
    res.setHeader('Cache-Control', 'public, max-age=0');
    if(err) framework.response500(req, res, err);
    else framework.response404(req, res);
}
    
    
function sendImage(req, res, id, buffer, mimeType){
    setHeaders(req, res, {
        path: res.path,
        size: buffer.length,
        mimeType: mimeType
    });
    
    // mark this response as custom
    framework.responseCustom(req, res);
    
    if(res.statusCode===200) {
        if(Buffer.isBuffer(buffer)) {
            res.write(buffer, 'binary');
            res.end();
        }
        else buffer.pipe(res);
    }
}

function sendGeneratedImage(req, res, w, h, bg_color, text){
    var fontSize = 20;
    if(w<100) fontSize = 10;
    if(w>=100 && w<150) fontSize = 15;
    
    var imgStream = framework_image.load(new Buffer(emptyPNG, 'base64'))
    .quality(80)
    .background(bg_color)
    .extent(w || 150, h || 150)
    .command('-fill','#707070') // dark-grey
    .command('-font','arial')
    .command('-pointsize', fontSize)
    .command('-draw','gravity Center text "0,0 \''+(text || (w+' x '+h))+'\'"');
    
    sendImage(req, res, text+'_'+w+'_'+h+'_'+bg_color, imgStream, 'image/png');
}


function imageRouter(req, res, isValidation) {
    if(req.method!=='GET' && req.method!=='HEAD') {
        if(isValidation) return false;
        else framework.view400();
    }
    
    // /cmsimages/12341234/100x200.extension
    var path = url.parse(req.url).pathname;
    
    // parse url
    var img = path.match(pathRgx_whc) || path.match(pathRgx);
    if(img) img = {
        id: img[1],
        whc: img.length===4 ? img[2] : null,
        extension: img[img.length-1]
    };
    if(img && img.extension && img.extension.toLowerCase) img.extension = img.extension.toLowerCase();
    if(!(img && img.id && ['jpg','jpeg','gif','png'].indexOf(img.extension) !== -1)) {
        if(isValidation) return false;
        else framework.view400();
    }
    else if(isValidation) return true;
    
    res.path = path;
    setHeaders(req, res, { path: path });
    if(res.statusCode===304) {
        framework.responseCustom(req, res); // mark this response as custom
        return res.end(); // image is cached, just send 304 (no modified)
    }
    
    var Image = Model(imageModelName);
    var w, h, bg_color, gravity, findResized, query, mode='resize';
    if(img.whc) {
        img.whc = img.whc.split('x');
        
        if(gravityShorts[img.whc[0]]) {
            gravity = img.whc.shift();
            if(gravity!=='resize') mode = 'crop';
        }
        
        w = parseInt(img.whc[0], 10) || 0;
        w = w <= maxW ? w : maxW;
        
        h = parseInt(img.whc[1], 10) || 0;
        h = h <= maxH ? h : maxH;
        
        bg_color = '#' + img.whc[2];
        if(bg_color === '#transparent' || bg_color === '#0') bg_color = 'transparent';
        else if(!bg_color.match(/^#([0-9a-f]{3}){1,2}$/i)) {
            bg_color = (img.id === 'generate') ? '#dddddd' : '#ffffff'; // for generated is default light-grey, otherwise white
        }
    }
    if(w > 0 && h > 0) {
        var findObj = { originalId:img.id, type:(mode==='crop' ? 'cropped' : 'resized'), width:w, height:h, bg_color:bg_color };
        
        // only search for gravity if cropped, resized can have gravity 'Center' or undefined
        if(mode==='crop') findObj.gravity = gravityShorts[gravity] || 'center';
        
        query = Image.collection().fields({ data:1, expire:1 }).find(findObj);
        findResized = true;
    }
    else query = Image.collection().fields({ data:1, expire:1 }).find({ id:img.id, type:'original' });
    
    if(img.id === 'generate'){
        sendGeneratedImage(req, res, w, h, bg_color);
    }
    else query.one(function(err, image){
        if(err) return imageError(err, req, res);
        
        if(image) {
            if(image.expire!==undefined && ((image.expire.getTime() - new Date().getTime()) < expireRenewHours*60*60*1000)){
                Image.collection().findId(image.id).update({ $set:{ expire:new Date().add('h',expireAfterHours) } }, function(err, count){
                    if(err) imageError(err, req, res);
                    else sendImage(req, res, image._id, image.data.buffer, image.mimeType);
                });
            }
            else sendImage(req, res, image._id, image.data.buffer, image.mimeType);
        }
        else if(findResized) {
            
            utils.queue('cmsimages-resize-queue', maxParallelResizes, function(next){
                
                // resized image not found, try to find original (non resized) image, and resize it
                Image.collection().fields({ data:1 }).find({ id:img.id, type:'original' }).one(function(err, origImage){
                    if(err) {
                        imageError(err, req, res);
                        return next();
                    }
                    
                    if(origImage){
                        var origW = origImage.width || w;
                        var origH = origImage.height || h;
                        
                        var resizeW = origW < w ? origW : w;
                        var resizeH = origH < h ? origH : h;
                        
                        var cropW = origW*(h/origH);
                        var cropH = h;
                        if(origW < w || origH < h){ // stop cropping if image is smaller than view
                            cropW = origW;
                            cropH = origH;
                        }
                        else if(cropW < w){
                            cropW = w;
                            cropH = origH;
                        }
                    
                        // resize image
                        var outType = (origImage.ext === 'png' || origImage.ext === 'gif') ? origImage.ext : 'jpg';
                        var imgSetup = framework_image.load(origImage.data.buffer).quality(90);
                        if(mode==='resize') imgSetup = imgSetup.resize(resizeW, resizeH); // resize only if image is bigger than canvas
                        if(mode==='crop') imgSetup = imgSetup.resize(cropW, cropH); // - working without crop method, maybe extent do it
                        //if(mode==='transparent') imgSetup = imgSetup; //.transparent(color) - implement in future
                        
                        imgSetup
                        .background(bg_color)
                        .gravity(gravityShorts[gravity] || 'center')
                        .extent(w, h);
                         
                        bufferFromStream(imgSetup.stream(outType), function(err, buffer) {
                            if(err) {
                                imageError(err, req, res);
                                return next();
                            }
                            if(buffer.length === 0){ // something is wrong with stream
                                imageError(err, req, res);
                                return next();
                            }
                            
                            // save image to db
                            origImage.variants()
                            .create({
                                type: (mode==='crop' ? 'cropped' : 'resized'),
                                gravity: (gravityShorts[gravity] || 'Center'),
                                name: origImage.name,
                                ext: origImage.ext,
                                mimeType: origImage.mimeType,
                                width: w,
                                height: h,
                                bg_color: bg_color,
                                data: buffer,
                                length: buffer.length,
                                expire: new Date().add('h',expireAfterHours) // expire after X hours

                            }, function(err, resizedImage){
                                if(err) imageError(err, req, res);
                                else sendImage(req, res, resizedImage.id, buffer, origImage.mimeType);
                                return next();
                            });
                        });
                    }
                    else {
                        sendGeneratedImage(req, res, w, h, '#F4ACAC', 'NOT FOUND'); // original image not found
                        return next();
                    }
                });
            });
        }
        else sendGeneratedImage(req, res, w, h, '#F4ACAC', 'NOT FOUND'); // original image not found
    });
}

/**
 * set headers include etag
 * @param {Object} req server request
 * @param {Object} res server response
 * @param {Object} opts path || id, ext, size, modifiedDT
 */
function setHeaders(req, res, fileStat){
    fileStat = fileStat || {};
    if(!fileStat.path && !fileStat.id) throw new Error('Missing "path" in first argument');
    //fileStat.modifiedDT = fileStat.modifiedDT || new Date(2000,1,1);
    //if(!(fileStat.modifiedDT instanceof Date)) Date.parse(fileStat.modifiedDT);
    
    //var etag = res.getHeader('ETag') || createEtag(fileStat.modifiedDT, (fileStat.path || fileStat.id));
    
    ////if (!res.getHeader('Accept-Ranges')) res.setHeader('Accept-Ranges', 'bytes');
    if (!res.getHeader('Date')) res.setHeader('Date', new Date().toUTCString());
    if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'public, max-age=11111111');
    //if (!res.getHeader('Last-Modified')) res.setHeader('Last-Modified', fileStat.modifiedDT.toUTCString());
    //if (!res.getHeader('ETag')) res.setHeader('ETag', etag);
    
//    var cacheHeaders = getCacheHeaders(req);
//    if(cacheHeaders) {
//        if(etag===cacheHeaders.etag && fileStat.modifiedDT.getTime() <= cacheHeaders.modifiedDT)
//            res.statusCode = 304;
//    }
//    else 
    if(fileStat.ext || fileStat.mimeType) {
        res.statusCode = 200;
        res.setHeader('Content-Type', fileStat.mimeType);
        if(fileStat.size) res.setHeader('Content-Length', fileStat.size);
    }
//    else res.statusCode = 200;
}

//function getCacheHeaders(req){
//    if(req.headers['if-none-match'] || req.headers['if-modified-since'])
//        return {
//            etag: req.headers['if-none-match'],
//            modifiedDT: Date.parse(req.headers['if-modified-since'])
//        };
//    else return null;
//}

/**
* Return a weak ETag from the given `path` and `stat`.
*
* @param {String} path
* @param {Object} stat
* @return {String}
*/
function createEtag(modifiedDT, path){
    var tag = modifiedDT + ':' + path;
    var hash = require('crypto')
        .createHash('md5')
        .update(tag, 'utf8')
        .digest('base64');
    return 'W/"' + hash + '"';
}

/*
 * headers to send on request with no cache:
 *
 * STATUS: 200
 * cache-control: 'public, max-age=0'
 * last-modified: modifiedDT
 * etag: getEtag
 * content-type: mime.getType(fileExt)
 * content-length: file.size
 *
 * STATUS: 304
 *
 * request headers:
 * if-modified-since {Date}
 * if-none-match {etag}
 * cache-control
 *
 * response headers:
 * cache-control
 * last-modified
 * etag
 *
 */