'use strict';

var http = require('http'),
    https = require('https'),
    Model = require('nodee-model');

var Image = Model.define('CmsImage', [ 'MongoDataSource' ], {
    
    // image can be associated with cms document
    document:{ isString:true },
    
    name:{ isString:true },
    originalId:{ isString:true },
    type:{ isIn:['original','resized','cropped'] }, // original,resized,croped
    data:{ buffer:true }, // data buffer
    height:{ isInteger:true },
    width:{ isInteger:true },
    gravity:{ isString:true },
    bg_color:{ isString:true },
    mimeType:{ isIn:['image/jpg','image/jpeg','image/gif','image/png'] },
    ext:{ isString:true },
    length:{ isInteger:true },
    expire:{ isDate:true }, // expire date
});

Model.relations.create('CmsImage.originalId [original] --> CmsImage [variants]', { maintainIntegrity:true, required:false, bulkRemove:true });

Image.extendDefaults({
    connection:{
        host: framework.config['cms-datasource-host'] || framework.config['datasource-primary-host'],
        port: framework.config['cms-datasource-port'] || framework.config['datasource-primary-port'],
        username: framework.config['cms-datasource-username'] || framework.config['datasource-primary-username'],
        password: framework.config['cms-datasource-password'] || framework.config['datasource-primary-password'],
        database: framework.config['cms-datasource-database'] || framework.config['datasource-primary-database'] || framework.config.name,
        collection: 'cms_images',
        
        indexes:{
            originalId:{'originalId':1},
            expire:{'expire':1, $options:{ expireAfterSeconds: 0 }},
            document:{'document':1}
        }
    },
    query:{
        
    },
    options:{
        fields:{
            id:1,
            modifiedDT:1,
            createdDT:1,
            name:1,
            document:1,
            originalId:1,
            type:1,
            //data:1, // dont load data, only if it is necessary
            height:1,
            width:1,
            bg_color:1,
            mimeType:1,
            ext:1,
            length:1,
            expire:1
        }
    }
});

/*
 * Ensure Indexes
 */

// init in index.js
// Image.init();


/*
 * Hooks
 */

Image.on('beforeCreate', function(next){
    var img = this;
    
    if(!img.type) next(new Error('CmsImage: INVALID').details({ code:'INVALID', validErrs:{ type:['required'] } }));
    else if(img.type !== 'original' && !img.originalId) next(new Error('CmsImage: INVALID').details({ code:'INVALID', validErrs:{ originalId:['invalid'] } }));
    else if(!img.mimeType) next(new Error('CmsImage: INVALID').details({ code:'INVALID', validErrs:{ mimeType:['required'] } }));
    else if(!img.name) next(new Error('CmsImage: INVALID').details({ code:'INVALID', validErrs:{ name:['required'] } }));
    else if(!img.length) next(new Error('CmsImage: INVALID').details({ code:'INVALID', validErrs:{ length:['required'] } }));
    else if(!img.width) next(new Error('CmsImage: INVALID').details({ code:'INVALID', validErrs:{ width:['required'] } }));
    else if(!img.height) next(new Error('CmsImage: INVALID').details({ code:'INVALID', validErrs:{ height:['required'] } }));
    else next();
});

Image.addMethod('download', function(url, cb){ // cb(err, image)
    var Img = this;
    var img = Img.new();
    
    getImgData(url, 7000, function(err, data, mimeType){ // max 7MB image size allowed
        if(err) cb(err);
        else {
            img.name = parseFileInfo(url).name;
            img.ext = parseFileInfo(url).ext;
            img.mimeType = mimeType;
            img.type = 'original';
            
            var dimensions = { width:null, height:null };
            
            if(mimeType==='image/jpg') dimensions = framework_image.measureJPG(data);
            else if(mimeType==='image/jpeg') dimensions = framework_image.measureJPG(data);
            else if(mimeType==='image/gif') dimensions = framework_image.measureGIF(data);
            else if(mimeType==='image/png') dimensions = framework_image.measurePNG(data);
            
            if(!dimensions) cb(new Error('Getting dimensions failed "' + url + '"'));
            else {
                img.width = dimensions.width;
                img.height = dimensions.height;
                
                img.validate();
                img.data = data;
                img.length = data.length;
                cb(null, img);
            }
        }
    });
});
    

// helpers
function parseFileInfo(url){
    var name = url.split('/')[url.split('/').length-1];
    var ext = name ? (name.split('.')[name.split('.').length-1] || '') : '';
    
    return {
        name: name,
        ext: ext
    };
}

function getImgData(url, maxSizeKB, cb){ // cb(err, data)
    var agent = http;
    if(url.substring(0,5)==='https') agent = https;
    maxSizeKB = maxSizeKB*1024;
    
    agent.get(url, function(res){
        var req = this;
        var imageData = '';
        var aborted = false;
        res.setEncoding('binary');
        
        var mimeType = res.headers['content-type'];
        if(!mimeType || !mimeType.match(/^image\/*.+/)){
            cb(new Error('MimeType not image "' +mimeType+ '"'));
            aborted = true;
            req.abort();
        }
        else if(['image/jpg','image/jpeg','image/gif','image/png'].indexOf(mimeType)===-1){
            cb(new Error('MimeType not supported, only image type (jpg,jpeg,gif,png) "' +mimeType+ '"'));
            aborted = true;
            req.abort();
        }
        
        res.on('data', function(chunk){
            if(res.statusCode !== 200) {
                cb(new Error('Response status "' +res.statusCode+ '"'));
                aborted = true;
                req.abort();
            }
            else {
                imageData += chunk;
                if(imageData.length > maxSizeKB) {
                    cb(new Error('Max byte size exceeded'));
                    aborted = true;
                    req.abort();
                }   
            }
        });
        
        res.on('end', function(){
            if(!aborted) cb(null, new Buffer(imageData, 'binary'), mimeType);
        });
    })
    .on('error', function(){
        cb(new Error('Downloading failed "' + url + '"'));
    });
}

