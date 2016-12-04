var Model = require('nodee-model');

var transmitBasePath = framework.config['transmit-base-path'] || '/_transmit';

var CmsDocumentTransmitAPI = Model.define( 'CmsDocumentTransmitAPI', [ 'ApiClient', 'Orderable', 'Tree' ], Model('CmsDocument').getSchema());

CmsDocumentTransmitAPI.extendSchema({
    content:{ hidden:false },
    containers:{ hidden:false }
});

CmsDocumentTransmitAPI.extendDefaults({
    connection:{
        basePath: transmitBasePath + '/cms-documents',
    },
    options:{
        hasCount: false, // if responses contains count
        autoPaging: true, // will auto request next page if query.limit not reached
        dynamicPageSize: false
    }
});

CmsDocumentTransmitAPI.transmitPriority = 9;
CmsDocumentTransmitAPI.transmitQuery = {};
CmsDocumentTransmitAPI.transmitFields = {};
CmsDocumentTransmitAPI.transmitBulkCreate = true;
// CmsDocumentTransmitAPI.transmitBulkUpdate = false;
// CmsDocumentTransmitAPI.transmitBulkRemove = false;

/*
 * Publish Rest APIs
 */

framework.rest(transmitBasePath +'/cms-documents', 'CmsDocument', [
    { route:'/', collection:'all', includeHiddenFields:true, flags:[ 'get', '!transmit_download' ] },
    { route:'/{id}', collection:'create', flags:[ 'post', 'json' ], length:3000 }, // up to 20000kB // allow bulk create to disable consistency checks
    { route:'/{id}', instance:'update', flags:[ 'put', 'json' ], length:3000 }, // up to 3000kB
    { route:'/{id}', instance:'remove', flags:[ 'delete' ], length:3000 }, // up to 3000kB
], ['authorize','!transmit','!transmit_upload']);
