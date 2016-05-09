var Model = require('nodee-model');

var transmitBasePath = framework.config['transmit-base-path'] || '/_transmit';

var CmsImageTransmitAPI = Model.define( 'CmsImageTransmitAPI', [ 'ApiClient', ], Model('CmsImage').getSchema());

CmsImageTransmitAPI.extendDefaults({
    connection:{
        basePath: transmitBasePath + '/cms-images',
    },
    options:{
        hasCount: false, // if responses contains count
        autoPaging: true, // will auto request next page if query.limit not reached
        dynamicPageSize: false,
        fields:{
            id:1,
            modifiedDT:1,
            createdDT:1,
            name:1,
            document:1,
            originalId:1,
            type:1,
            data:1, // allways load data
            gravity:1,
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

CmsImageTransmitAPI.transmitPriority = 8;
CmsImageTransmitAPI.transmitQuery = { type:'original' };
CmsImageTransmitAPI.transmitFields = {};

/*
 * Publish Rest APIs
 */

framework.rest(transmitBasePath +'/cms-images', 'CmsImage', [
    { route:'/', collection:'all', filter:allFields, includeHiddenFields:true, flags:[ 'get', '!transmit_download' ] },
    { route:'/{id}', instance:'create', flags:[ 'post', 'json' ], length:3000 }, // up to 3000kB
    { route:'/{id}', instance:'update', flags:[ 'put', 'json' ], length:3000 }, // up to 3000kB
    { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
], ['authorize','!transmit','!transmit_upload']);

function allFields(ctx, next){
    ctx.query.$fields = { data:1 };
    next();
}