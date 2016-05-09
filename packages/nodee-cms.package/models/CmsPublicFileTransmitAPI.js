var Model = require('nodee-model');

var transmitBasePath = framework.config['transmit-base-path'] || '/_transmit';

var CmsPublicFileTransmitAPI = Model.define( 'CmsPublicFileTransmitAPI', [ 'ApiClient', 'Orderable', 'Tree' ], Model('CmsPublicFile').getSchema());

CmsPublicFileTransmitAPI.extendDefaults({
    connection:{
        basePath: transmitBasePath + '/cms-public-files',
    },
    options:{
        hasCount: false, // if responses contains count
        autoPaging: true, // will auto request next page if query.limit not reached
        dynamicPageSize: false
    }
});

CmsPublicFileTransmitAPI.transmitPriority = 7;
CmsPublicFileTransmitAPI.transmitQuery = {};
CmsPublicFileTransmitAPI.transmitFields = { data:true };

/*
 * Publish Rest APIs
 */

framework.rest(transmitBasePath +'/cms-public-files', 'CmsPublicFile', [
    { route:'/', collection:'all', flags:[ 'get', '!transmit_download' ] },
    { route:'/{id}', instance:'create', flags:[ 'post', 'json' ], length:3000 }, // up to 3000kB
    { route:'/{id}', instance:'update', flags:[ 'put', 'json' ], length:3000 }, // up to 3000kB
    { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
], ['authorize','!transmit','!transmit_upload']);