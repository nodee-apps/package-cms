var Model = require('nodee-model');

var transmitBasePath = framework.config['transmit-base-path'] || '/_transmit';

var CmsTemplateTransmitAPI = Model.define( 'CmsTemplateTransmitAPI', [ 'ApiClient', 'Orderable', 'Tree' ], Model('CmsTemplate').getSchema());

CmsTemplateTransmitAPI.extendDefaults({
    connection:{
        basePath: transmitBasePath + '/cms-templates',
    },
    options:{
        hasCount: false, // if responses contains count
        autoPaging: true, // will auto request next page if query.limit not reached
        dynamicPageSize: false
    }
});

CmsTemplateTransmitAPI.transmitPriority = 10;
CmsTemplateTransmitAPI.transmitQuery = {};
CmsTemplateTransmitAPI.transmitFields = { content:true };

/*
 * Publish Rest APIs
 */

framework.rest(transmitBasePath +'/cms-templates', 'CmsTemplate', [
    { route:'/', collection:'all', flags:[ 'get', '!transmit_download' ] },
    { route:'/{id}', instance:'create', flags:[ 'post', 'json' ], length:3000 }, // up to 3000kB
    { route:'/{id}', instance:'update', flags:[ 'put', 'json' ], length:3000 }, // up to 3000kB
    { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
], ['authorize','!transmit','!transmit_upload']);