'use strict';

var Model = require('nodee-model'),
    object = require('nodee-utils').object;

/*
 * CMS FORM ENTRY
 * filled form records
 */

// helper for validating data
Model.define('CmsFormEntryData',[],{});

var CmsFormEntry = Model.define('CmsFormEntry', [ 'MongoDataSource' ], {
    formId:{ isString:true },
    key:{ toString:true, isString:true }, // pairing key
    data:{},
    logs:{ isArray:true } // email sending logs { status:'success/error', event:'email/...', error:'error message', createdDT:new Date() }
});

CmsFormEntry.on('beforeCreate', formIdRequired);
CmsFormEntry.on('beforeUpdate', formIdRequired);
function formIdRequired(next){
    if(!this.id) this.logs = []; // set logs to empty array on create
    if(!this.formId) next(new Error('CmsFormEntry: INVALID').details({ code:'INVALID', validErrs:{ formId:['required'] } }));
    else next();
}

CmsFormEntry.extendDefaults({
    connection:{
        host: framework.config['cms-datasource-host'] || framework.config['datasource-primary-host'],
        port: framework.config['cms-datasource-port'] || framework.config['datasource-primary-port'],
        username: framework.config['cms-datasource-username'] || framework.config['datasource-primary-username'],
        password: framework.config['cms-datasource-password'] || framework.config['datasource-primary-password'],
        database: framework.config['cms-datasource-database'] || framework.config['datasource-primary-database'] || framework.config.name,
        collection: 'cms_form_entries',
        indexes:{
            formId:{ 'formId':1 },
            key:{ 'key':1 }
        }
    }
});

// init in index.js
// CmsFormEntry.init();

CmsFormEntry.on('beforeCreate', function(next){ // next([err])
    if(!this.isValid()) this.validateData(next);
    else next();
});

CmsFormEntry.on('beforeUpdate', function(next){ // next([err])
    if(!this.isValid()) this.validateData(next);
    else next();
});

CmsFormEntry.prototype.validateData = function(cb){ // cb([err], entry, form)
    var entry = this;
    
    if(!entry.formId) cb(new Error('CmsFormEntry: INVALID').details({ code:'INVALID', validErrs:{ formId:['invalid'] } }));
    Model('CmsForm').collection().cache().findId(entry.formId).one(function(err, form){
        if(err) cb(err);
        else if(!form) cb(new Error('CmsFormEntry: INVALID').details({ code:'INVALID', validErrs:{ formId:['invalid'] } }));
        else {
            // validate fomr entry by form schema
            var data = Model('CmsFormEntryData').new(entry.data||{}, form.entrySchema).validate(form.entrySchema);
            
            if(!data.isValid()) return cb(new Error('CmsFormEntry: INVALID').details({ code:'INVALID', validErrs:data.validErrs() }));
            entry.data = data.getData(form.entrySchema);
            
            if(form.entryKey) entry.key = object.deepGet(entry.data, form.entryKey);
            entry.setValid();
            cb(null, entry, form);
        }
    });
};


/*
 * CMS FORM
 * form definitions, include schema, redirects, email etc...
 */

var CmsForm = Model.define('CmsForm', [ 'MongoDataSource', 'Orderable' ], {
    name:{ isString:true }, // form name
    description:{ isString:true }, // form description
    redirect:{ isString:true }, // if defined, 302 redirect after submit will be applied
    allowCors:{ isBoolean:true }, // allow cors in json post requests
    
    // entry definition
    entrySchema:{}, // data schema of entry
    entryKey:{ isString:true }, // if pairing key is set, form entry will become pair-able - can pair data on pairingKey, also required
    
    // emails definition
    emails:{
        isArrayOf: Model.define({
            propName:{ isString:true },
            sendOn:{ isIn:[ 'define', 'change', 'always', 'never' ] },
            mailer:{ isString:true }, // mailer config name, default is primary
            documentUrl:{ isString:true }, // url of document to send as email body
            subject:{ isString:true }, // subject of email to send
            to:{ isString:true }, // comma separated list, can use brackets inside e.g. [[lead.email]]
            cc:{ isString:true }, // comma separated list, can use brackets inside e.g. [[shareTo]]
            bcc:{ isString:true } // comma separated list, can use brackets inside e.g. [[shareTo]]
        })
    }
});

/*
 * defaults
 */

CmsForm.extendDefaults({
    connection:{
        host: framework.config['cms-datasource-host'] || framework.config['datasource-primary-host'],
        port: framework.config['cms-datasource-port'] || framework.config['datasource-primary-port'],
        username: framework.config['cms-datasource-username'] || framework.config['datasource-primary-username'],
        password: framework.config['cms-datasource-password'] || framework.config['datasource-primary-password'],
        database: framework.config['cms-datasource-database'] || framework.config['datasource-primary-database'] || framework.config.name,
        collection: 'cms_forms'
    }
});

/*
 * Relations
 */

Model.relations.create('CmsFormEntry.formId [form] --> CmsForm [entries]', { maintainIntegrity:['remove'], bulkRemove:true });

/*
 * Ensure Indexes
 */

CmsForm.init();

/*
 * Business logic
 */

// before create
CmsForm.on('beforeCreate', function(next){ // next(err)
    var form = this;
    form.entrySchema = form.entrySchema || {}; // data schema of entry
    form.emails = form.emails || [];
    
    // check if mailer config exists, if it is missing, default mailer will be used
    //if(form.mailer && !MODULE('nodee-admin').config.mailer[ form.mailer ]){
    //    return next(new Error('CmsForm: INVALID').details({ code:'INVALID', validErrs:{ mailer:['invalid'] } }));
    //}
    
    //// check if cms document exists if defined
    //if(form.emailDocument){
    //    Model('CmsDocument').collection().findId(form.emailDocument)
    //    
    //       .....
    //}
    //else next();
    
    next();
});

// clear cache after update
CmsForm.on('afterUpdate', function(args, next){ // next([err])
    // clear cached form definition - it is used by form entries
    this.constructor.collection().findId(this.id).clearCache('one', next);
});