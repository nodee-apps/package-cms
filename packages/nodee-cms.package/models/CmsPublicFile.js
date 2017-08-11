'use strict';
/*
 * Replace total.js utils.etag to ensure refreshing public files on client side, after update
 *
 * etag usage in Framework.prototype.responseFile:
 * var etag = utils.etag(req.url, self.config['etag-version']);
 *
 */

var origEtag = framework_utils.etag;
var publicFilesEtags = {}; // cached publicFiles list, for generating etag 
framework_utils.etag = function(text, version){
    if(publicFilesEtags[ text ]) return publicFilesEtags[ text ];
    return origEtag(text, version);
};


var async = require('nodee-utils').async,
    Model = require('nodee-model'),
    fs = require('fs'),
    cluster = require('cluster');

var PublicFile = Model.define('CmsPublicFile', [ 'FileSystemDataSource' ], {
    // all props are inherited from FileSystemDataSource
});

/*
 * defaults
 */

PublicFile.extendDefaults({
    connection:{
        dirPath:'./public'
    }
});

/*
 * Backup options
 */
PublicFile.backupCreateHooks = ['create'];
PublicFile.backupUpdateHooks = ['update','write'];
PublicFile.backupRemoveHooks = ['remove'];
PublicFile.backupFields = { data:true };
// if removing folders, it removes all child items, therefore we need to send backup service order to remove all descendants
PublicFile.backupRemoveBulk = function(query, instance){
    return {
        $or:[
            { 'data.ancestors': instance.id },
            { originalId: query.originalId }
        ]
    };
};

/*
 * Ensure Indexes, etc...
 */


// init in index.js
PublicFile.afterInit = function(cb){
    PublicFile.init(function(){
        PublicFile.collection().all(function(err, files){
            if(err) throw err;
            else for(var i=0;i<files.length;i++){
                if(files[i].isFile) setEtag(files[i].id, files[i].isFile, files[i].modifiedDT);
            }

            cb();
        });
    });
};


/*
 * instance methods
 */


/*
 * Business logic
 */

PublicFile.on('afterCreate', function(args, next){
    var file = args[1];
    
    informWorkers(file.id, file.isFile, new Date());
    setEtag(file.id, file.isFile, new Date());
    next();
});

PublicFile.on('afterWrite', function(args, next){
    var file = this;
    
    informWorkers(file.id, true, new Date());
    setEtag(file.id, true, new Date());
    next();
});

PublicFile.on('afterRemove', function(args, next){
    var file = args[1];
    
    informWorkers(file.id, file.isFile, null);
    setEtag(file.id, file.isFile, null);
    next();
});

/*
 * Messages
 */

// receive msg from others
if(!cluster.isMaster){
    process.on('message', function(msg) {
        msg = msg || {};
        
        // don't listen to messages from other modules
        if(msg.module!=='nodee-cms') return;
        
        if(msg.cmd === 'file_changed') {
            setEtag(msg.fileId, msg.isFile, msg.modifiedDT);
        }
    });
}

function informWorkers(fileId, isFile, modifiedDT){
    if(!cluster.isMaster){
        process.send({
            module:'nodee-cms',
            cmd: 'file_changed',
            fileId: fileId,
            isFile: isFile,
            modifiedDT: modifiedDT,
            broadcast:true
        });
    }
}

/*
 * Helpers
 */
function setEtag(fileId, isFile, modifiedDT){
    var tmpFileId = fileId.replace(/\//g,'-'); // images/logo.png --> images-logo.png
    
    if(!isFile && !modifiedDT) { // folder was removed, delete all descendant etags
        for(var key in publicFilesEtags){
            if(key.indexOf('/'+fileId)===0) {
                // reset cached file
                delete framework.temporary.path[ key.substring(1).replace(/\//g,'-') ]; // /removedfolder/logo.png --> removedfolder-logo.png
                
                // update file etag
                if(!modifiedDT) delete publicFilesEtags[ key ];
                else publicFilesEtags[ key ] = createEtag(modifiedDT, key);
            }
        }
    }
    else {
        // reset cached file
        delete framework.temporary.path[ tmpFileId ];
        
        // update file etag
        if(!modifiedDT) delete publicFilesEtags[ '/'+fileId ];
        else publicFilesEtags[ '/'+fileId ] = createEtag(modifiedDT, fileId);
    }
}

function createEtag(modifiedDT, path){
    var tag = modifiedDT + ':' + path;
    var hash = require('crypto')
        .createHash('md5')
        .update(tag, 'utf8')
        .digest('base64');
    return 'W/"' + hash + '"';
}