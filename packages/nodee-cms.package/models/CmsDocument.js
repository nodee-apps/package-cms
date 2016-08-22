'use strict';

var url = require('url'),
    generateID = require('nodee-utils').shortId.generate,
    async = require('nodee-utils').async,
    Model = require('nodee-model');

var CmsDoc = Model.define('CmsDocument', [ 'MongoDataSource', 'Orderable', 'Tree' ], {
    
    // basic props
    title: { isString:true }, // page title
    urlName: { defaultValue:'', isString:true, cleanUrl:true }, // onchange - update descs
    url:{ isString:true }, // readonly, inherited from parents
    published: { isBoolean:true }, // onchange - update descs
    
    // advanced props
    //internalRedirect: { defaultValue:'', isString:true },
    requireSSL:{ defaultValue:false, isBoolean:true }, // onchange - update descs
    allowRoles:{ isArray:true }, // onchange - update descs
    denyRoles:{ isArray:true }, // onchange - update descs
    
    template:{ isString:true },
    templateName:{ isString:true }, // helper for sitemap traversing
    templateSettings:{}, // extend template attributes or editors settings { 'laylouts/page.html':{ attributes:{ 'propName':{ disabled:true } }, editors:{ 'selector':{ disabled:false } } } }
    icon:{ isString:true }, // css class of icon used in sitemap tree view, if none default will be used
    color:{ isString:true }, // background color used in sitemap tree view, if none white will be used
    
    // content props    
    content:{ hidden:true }, // will not be seen by JSON.stringify
    attributes:{},
    
    containers:{ hidden:true }, // containers settings and content { 'left-container':[ { id:'widget1', template:'widgets/menu.html' } ] }
    contTemplates:{ isArray:true } // array of used templates in containers, it helps to prevent removing templates that are used
});

CmsDoc.onFill(function(doc){
    if((!doc.urlName || doc.urlName==='') && doc.title) {
        doc.urlName = doc.title;
        doc.checkProp('urlName');
    }
    return doc;
});


/*
 * defaults
 */

var docCacheDuration = framework.config['cms-documents-caching'];
if(docCacheDuration === true) docCacheDuration = 1*60*1000; // default 1 minute

CmsDoc.extendDefaults({
    connection:{
        host: framework.config['cms-datasource-host'] || framework.config['datasource-primary-host'],
        port: framework.config['cms-datasource-port'] || framework.config['datasource-primary-port'],
        database: framework.config['cms-datasource-database'] || framework.config['datasource-primary-database'] || framework.config.name,
        collection: 'cms_documents',
        indexes:{
            // ancestors:{ 'ancestors':1 }, added in Tree
            url:{ 'url':1 },
            urlName:{ 'urlName':1 },
            published:{ 'published':1 },
            template:{ 'template':1 },
            templateName:{ 'templateName':1 },
            contTemplates:{ 'contTemplates':1 }
        }
    },
    query:{},
    options:{
        storeChildrenCount:true
    },
    cache:{
        duration: docCacheDuration
    }
});

/*
 * Cms Documents Trash
 */

var CmsDocumentTrash = Model.define('CmsDocumentTrash', [ 'MongoDataSource' ], CmsDoc.getSchema());
CmsDocumentTrash.extendSchema({ expire:{ date:true } });
CmsDocumentTrash.extendDefaults(CmsDoc.getDefaults()).extendDefaults({ 
    connection:{ 
        collection:'cms_documents_trash',
        indexes:{
            expire:{'expire':1, $options:{ expireAfterSeconds: 0 }}
        }
    } 
});

/*
 * Ensure Indexes
 */

// init in index.js
// CmsDoc.init();
// CmsDocumentTrash.init();

/*
 * Document methods
 */


// reset cached documents by id and url - using by cms.router
CmsDoc.addMethod('resetRoute', function(doc, cb){ // cb(err)
    if(typeof cb !== 'function') throw new Error('Wrong arguments');
    CmsDoc.collection().find({ url: doc.url }).clearCache('one', function(err){
        if(err) cb(err);
        else if(doc.oldUrl) CmsDoc.collection().find({ url: doc.oldUrl }).clearCache('one', function(err){
            if(err) cb(err);
            else CmsDoc.collection().findId(doc.id).clearCache('one',cb);
        });
        else CmsDoc.collection().findId(doc.id).clearCache('one',cb);
    });
});


/*
 * instance methods
 */
    

/*
 * Business logic
 */

// before create
CmsDoc.on('beforeCreate', function(next){ // next(err)
    var doc = this;
    
    // basic props
    if(!doc.title) return next(new Error('CmsDocument beforeCreate: INVALID').details({ code:'INVALID', validErrs:{ title:['required'] } }));
    
    // document type props - onchange update all documents with this type type
    if(!doc.template) return next(new Error('CmsDocument beforeCreate: INVALID').details({ code:'INVALID', validErrs:{ template:['required'] } }));
    
    // document urlName is required - generated onFill from title if missing
    if(!doc.urlName) return next(new Error('CmsDocument beforeCreate: INVALID').details({ code:'INVALID', validErrs:{ urlName:['required'] } }));
    
    doc.templateName = doc.template.split('/').pop().replace(/\.html$/g,'');
    doc.templateSettings = doc.templateSettings || {};
    doc.published = doc.published || false;
    
    // advanced props
    //doc.internalRedirect = doc.internalRedirect || '';
    doc.requireSSL = doc.requireSSL || false;
    doc.allowRoles = doc.allowRoles || [];
    doc.denyRoles = doc.denyRoles || [];
    
    // content props    
    doc.content = doc.content || {};
    doc.containers = doc.containers || {};
    doc.attributes = doc.attributes || {};
    
    createUrl(doc, next);
});
 
// before update validation
CmsDoc.on('beforeUpdate', function(next){ // next([err])
    var doc = this;
    
    // cannot change template of existing document
    doc.hide('template', 'getData');
    doc.hide('templateName', 'getData');
    
    doc.constructor.collection().findId(doc.id).fields({ url:1, urlName:1, published:1, requireSSL:1, allowRoles:1, denyRoles:1 }).one(function(err, oldDoc){
        if(err) next(err);
        else {
            doc.oldUrl = oldDoc.url;
            doc.oldUrlName = oldDoc.urlName;
            doc.oldPublished = oldDoc.published;
            doc.oldRequireSSL = oldDoc.requireSSL;
            doc.oldAllowRoles = oldDoc.allowRoles;
            doc.oldDenyRoles = oldDoc.denyRoles;
            
            // create url and check if it's unique
            createUrl(doc, next);
        }
    });
});


// sync descendants & reset document cache
CmsDoc.on('afterUpdate', function(args, next){ // next([err])
    var doc = this;
    
    // sync descendants
    syncDescendants(doc, function(err){
        if(err) next(err);
        else CmsDoc.resetRoute(doc, next);
    });
});

// move document and his children to trash (before default Tree beforeRemove method "removeChildren")
CmsDoc.on('beforeRemove', { addBefore:'removeChildren' }, function(next){
    var doc = this;
    doc.expire = new Date().add('days',14);
    
    // get all descendants
    doc.constructor.collection().find({ ancestors:doc.id }).all(function(err, descs){
        if(err) return next(new Error((doc.constructor._name)+' on beforeRemove: cannot find descendants of ID "' +doc.id+ '"').cause(err));
        
        var ids = [doc.id];
        for(var i=0;i<descs.length;i++) ids.push(descs[i].id);

        // remove prev document and his descendants in trash to avoid ID duplicity conflict
        Model('CmsDocumentTrash').collection().findId(ids).remove(function(err){
            if(err) return next(new Error((doc.constructor._name)+' on beforeRemove: cannot remove descendants from trash of ID "' +doc.id+ '"').cause(err));
    
            // move document and all of his descendants to trash
            Model('CmsDocumentTrash').collection().create([doc].concat(descs), function(err){
                if(err) return next(new Error((doc.constructor._name)+' on beforeRemove: cannot create descendants in trash of ID "' +doc.id+ '"').cause(err));
                else next(); // continue to removingChildren
            });
        });
    });
});

// reset routes cache after Remove
CmsDoc.on('afterRemove', function(args, next){ // next([err])
    var doc = this;
    CmsDoc.resetRoute(doc, next);
});


// TODO: handle moving documents - best way is to not move, but create new one and delete old
//// sync descendants & reset document cache
//CmsDoc.on('beforeRemove', function(args, next){ // next([err])
//    var doc = this;
//    if(!doc.urlPath) doc.constructor.collection().findId(doc.id).one(function(err, oldDoc){
//        if(err) next(err);
//        else {
//            doc.urlPath = oldDoc.urlPath;
//            CmsDoc.resetRoute(doc, next);
//        }
//    });
//    else CmsDoc.resetRoute(doc, next);
//});
//
//// refresh all 
//CmsDoc.on('afterMove', function(args, next){ // next([err])
//    var doc = this;
//    
//    createUrlPath(doc, function(err, doc){
//        if(err) next(err);
//        else syncDescendants(doc, function(err){
//            if(err) next(err);
//            else CmsDoc.resetRoute(doc, next);
//        });
//    });
//});

/*
 * helpers
 */
function createUrl(doc, cb){ // cb(err, doc)
    // get all ancestors
    doc.getParent().one(function(err, parent){
        if(err) cb(err);
        else {
            if(parent) doc.url = parent.url + '/' + doc.urlName;
            else doc.url = '//' + doc.urlName;
            
            // check if path is unique
            doc.constructor.collection().find({ url:doc.url, id:{ $ne:doc.id } }).exists(function(err, duplPath){
                if(err) cb(err);
                else {
                    if(duplPath) {
                        var randomString = '-' + generateID();
                        doc.urlName += randomString;
                        doc.url += randomString;
                    }
                    cb(null, doc);
                }
            });
        }
    });
}

/*
 * recursive update descendants:
 * requireSSL
 * allowRoles
 * denyRoles
 * published
 * url
 *
 * and clear cached routes
 */
function syncDescendants(doc, cb){ // cb(err)
    
    // urlName not changed, just perform bulk update
    if(doc.oldUrlName === doc.urlName){
        cb();
        
        //doc.constructor
        //.collection()
        //.find({
        //    ancestors:doc.id,
        //    $or:[
        //        { requireSSL: !(doc.requireSSL === undefined ? doc.oldRequireSSL : doc.requireSSL) },
        //        { allowRoles: { $ne: doc.allowRoles || doc.oldAllowRoles } },
        //        { denyRoles: { $ne: doc.denyRoles || doc.oldDenyRoles } },
        //        { published: !(doc.published === undefined ? doc.oldPublished : doc.published) }
        //    ]
        //})
        //.update({
        //    requireSSL: doc.requireSSL === undefined ? doc.oldRequireSSL : doc.requireSSL,
        //    allowRoles: doc.allowRoles || doc.oldAllowRoles,
        //    denyRoles: doc.denyRoles || doc.oldDenyRoles,
        //    published: doc.published === undefined ? doc.oldPublished : doc.published
        //    
        //}, function(err, count){
        //    cb(new Error('CmsDocument: failed to update descendants').cause(err));
        //});
    }
    
    // url name changed, need to update all descendants
    else doc.constructor
        .collection()
        .find({ ancestors:doc.id })
        .fields({ id:1, url:1 })
        .all(function(err, descendants){
        
        if(err) cb(err);
        else if(descendants.length > 0) {
            async.Series.each(descendants, function(i, next){
                
                // sync properties
                //descendants[i].requireSSL = doc.requireSSL === undefined ? doc.oldRequireSSL : doc.requireSSL;
                //descendants[i].allowRoles = doc.allowRoles || doc.oldAllowRoles;
                //descendants[i].denyRoles = doc.denyRoles || doc.oldDenyRoles;
                //descendants[i].published = doc.published === undefined ? doc.oldPublished : doc.published;
                
                // sync url
                var descOldUrl = descendants[i].url+'';
                descendants[i].url = descendants[i].url.replace(new RegExp('^('+doc.oldUrl.escape()+'[^\/]*)'), doc.url);
                
                doc.constructor.collection().findId(descendants[i].id).update(descendants[i], function(err, desc){
                    if(err) next(new Error('CmsDocument: failed to update descendant').cause(err));
                    else CmsDoc.resetRoute({ id:descendants[i].id, url:descendants[i].url ,oldUrl:descOldUrl }, next);
                });
            }, function(err){
                if(err) cb(err);
                else cb();
            });
        }
        else cb();
    });
}