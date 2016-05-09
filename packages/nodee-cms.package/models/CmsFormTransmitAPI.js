var Model = require('nodee-model');

var transmitBasePath = framework.config['transmit-base-path'] || '/_transmit';

/*
 * CMS FORM ENTRIES
 */

var CmsFormEntryTransmitAPI = Model.define( 'CmsFormEntryTransmitAPI', [ 'ApiClient' ], Model('CmsFormEntry').getSchema());

CmsFormEntryTransmitAPI.extendDefaults({
    connection:{
        basePath: transmitBasePath + '/cms-form-entries',
    },
    options:{
        hasCount: false, // if responses contains count
        autoPaging: true, // will auto request next page if query.limit not reached
        dynamicPageSize: false
    }
});

CmsFormEntryTransmitAPI.transmitPriority = 5;
CmsFormEntryTransmitAPI.transmitQuery = {};
CmsFormEntryTransmitAPI.transmitFields = {};

/*
 * Publish Rest APIs
 */

framework.rest(transmitBasePath +'/cms-form-entries', 'CmsFormEntry', [
    { route:'/', collection:'all', includeHiddenFields:true, flags:[ 'get', '!transmit_download' ] },
    { route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
    { route:'/{id}', instance:'update', flags:[ 'put', 'json' ] },
    { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
], ['authorize','!transmit','!transmit_upload']);


/*
 * CMS FORM
 */

var CmsFormTransmitAPI = Model.define( 'CmsFormTransmitAPI', [ 'ApiClient', 'Orderable' ], Model('CmsForm').getSchema());

CmsFormTransmitAPI.extendDefaults({
    connection:{
        basePath: transmitBasePath + '/cms-forms',
    },
    options:{
        hasCount: false, // if responses contains count
        autoPaging: true, // will auto request next page if query.limit not reached
        dynamicPageSize: false
    }
});

CmsFormTransmitAPI.transmitPriority = 6;
CmsFormTransmitAPI.transmitQuery = {};
CmsFormTransmitAPI.transmitFields = {};

/*
 * Publish Rest APIs
 */

framework.rest(transmitBasePath +'/cms-forms', 'CmsForm', [
    { route:'/', collection:'all', includeHiddenFields:true, flags:[ 'get', '!transmit_download' ] },
    { route:'/{id}', instance:'create', flags:[ 'post', 'json' ] },
    { route:'/{id}', instance:'update', flags:[ 'put', 'json' ] },
    { route:'/{id}', instance:'remove', flags:[ 'delete' ] }
], ['authorize','!transmit','!transmit_upload']);
