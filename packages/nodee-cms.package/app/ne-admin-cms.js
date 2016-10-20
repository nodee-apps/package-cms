angular.module('neAdmin.cms',['neRest',
                              'neTree',
                              'neLocal',
                              'neModals',
                              'neNotifications',
                              'neObject',
                              'neEditable',
                              'neEditable.image',
                              'neEditable.text',
                              'neEditable.attribute',
                              'neEditable.container'
])
.factory('neCms', ['NeRestResource', function(Resource){
    var cms = this;
    
    cms.documents = new Resource({
        baseUrl:'cms/documents',
        commands:{
            content:{
                method:'POST',
                url:'/{id}/content'
            },
            position:{
                method:'PUT',
                url:'/{id}/position'
            }
        }
    });
    
    cms.templates = new Resource({
        baseUrl:'cms/templates',
        commands:{
            content:{
                method:'GET',
                url:'/{id}/content'
            },
            updateContent:{
                method:'POST',
                url:'/{id}/updatecontent?modifiedDT={modifiedDT}'
            },
            meta:{
                method:'GET',
                url:'/{id}/meta'
            }
        }
    });
    
    cms.pages = new Resource({
        baseUrl:'cms/templates/types/pages'
    });
    
    cms.widgets = new Resource({
        baseUrl:'cms/templates/types/widgets'
    });
    
    cms.images = new Resource({
        baseUrl:'cms/images',
        commands:{
            upload:{
                method:'POST-MULTIPART'
            }
        }
    });
    
    cms.files = new Resource({
        baseUrl:'cms/files',
        commands:{
            read:{
                method:'GET',
                url:'/{id}/read'
            },
            write:{
                headers:{ 'Content-Type': 'text/plain' },
                method:'POST',
                url:'/{id}/write?modifiedDT={modifiedDT}'
            },
            upload:{
                method:'UPLOAD'
            }
        }
    });
    
    cms.forms = Resource.define({
        baseUrl:'cms/forms'
    });
    
    cms.form_entries = Resource.define({
        baseUrl:'cms/form_entries'
    });
    
    return cms;
}])
.controller('CmsImagesCtrl', ['$scope', 'neCms', 'NeGrid', 'NeTree', 'neNotifications','neModals','NeUploadHandler', function($scope, cms, Grid, Tree, notify, modals, UploadHandler){
    
    $scope.tree = new Tree({
        id: 'cms.documents',
        resource: cms.documents,
        ancestorsReferenceKey:'ancestors',
        childrenCountKey:'childrenCount',
        autoLoad: true,
        defaultSort:{},
        limit:10,
        defaultQuery:{},
        itemTemplate: 'views/cms-images-document-item.html',
        onFocus: function(item){
            $scope.document = item;
            if(item.$focused) $scope.grid.setQuery({ type:'original', document:item.id });
        }
    });
    
    $scope.grid = new Grid({
        id: 'cms.images',
        resource: cms.images,
        autoLoad: true,
        multiselect: true,
        defaultSort:{ createdDT:-1 },
        limit: !cms.sitemapTree ? 20 : 8,
        defaultQuery:{ type:'original' }
    });
    
    // load data if primary document tree is not defined
    if(!cms.sitemapTree) {
        $scope.tree.load();
        $scope.grid.load();
    }
    else { // copy state from sitemapTree
        $scope.tree.items = angular.copy(cms.sitemapTree.items);
        if(cms.sitemapTree.focusedItem) {
            $scope.tree.walkItems(function(item){
                if(item.id===cms.sitemapTree.focusedItem.id) {
                    $scope.tree.focusItem(item);
                    return true; // stop walking
                }
            });
        }
        else $scope.grid.setPage(1);
    }
    
    $scope.selectAll = function(){
        if($scope.document) $scope.tree.focusItem($scope.document, true); // toggle focused
        $scope.document = null;
        $scope.grid.setQuery({ type:'original' });
    };
                                
    $scope.upload = new UploadHandler(cms.images.upload);
    $scope.upload.resourceUploadBody = function(fileName, file){
        var document = $scope.tree.getFocusedItem();
        return {
            document: (document||{}).id || '',
            image: file
        };
    };
    $scope.upload.onUpload = function(){
        $scope.grid.refresh();
    };
    $scope.upload.onComplete = function(){
        $scope.grid.refresh();
    };
    
    $scope.removeSelected = function(){
        var items = $scope.grid.getSelectedItems();
        for(var i=0;i<items.length;i++) $scope.grid.removeItem(items[i]);
    };
}])
.controller('CmsFilesCtrl', ['$scope', '$window', 'neCms', 'NeGrid', 'NeTree', 'neNotifications','neModals','NeUploadHandler','neLocal', function($scope, $window, cms, Grid, Tree, notify, modals, UploadHandler, local){
    
    $scope.tree = new Tree({
        id: 'cms.files',
        resource: cms.files,
        autoLoad: true,
        multiSelect: false,
        defaultSort:{ id:1 },
        limit:10,
        ancestorsReferenceKey: 'ancestors',
        defaultQuery:{ isDir:true },
        itemTemplate: 'views/cms-files-item.html',
        onFocus: function(item){
            $scope.folder = item;
            var levelQuery = item ? [{ ancestors:{ $size: item.ancestors.length+1 } }, { ancestors: item.id }] : [{ ancestors:{ $size:0 } }];
            $scope.grid.setFilter({ $and:levelQuery });
        }
    }).load();
    
    $scope.grid = new Grid({
        id: 'cms.files',
        resource: cms.files,
        autoLoad: true,
        multiselect: true,
        defaultSort:{ createdDT:-1 },
        limit:20,
        defaultQuery:{ isFile:true }
    });
    
    
    $scope.upload = new UploadHandler(cms.files.upload);
    $scope.upload.resourceUploadBody = function(fileName, file){
        var parent = $scope.tree.getFocusedItem();
        return {
            id: parent.id +'/'+ fileName,
            ancestors: parent.ancestors.concat(parent.id).join(','),
            file: file
        };
    };
    $scope.upload.onUpload = function(){
        $scope.grid.refresh();
    };
    $scope.upload.onComplete = function(){
        $scope.grid.refresh();
    };
    
    $scope.removeSelected = function(){
        var items = $scope.grid.getSelectedItems();
        for(var i=0;i<items.length;i++) $scope.grid.removeItem(items[i]);
    };
    
    $scope.tree.createModal = function(parent){
        modals.create({
            id:'cms.files.create',
            title:'Create Folder or File',
            include:'views/cms-files-create.html',
            create: function(item){
                $scope.tree.createItem(parent, {
                    id: parent ? parent.id +'/'+ item.name : item.name,
                    isDir: !item.isFile,
                    isFile: item.isFile
                },
                !item.isFile, // if item is directory, append it to tree
                function(){
                    if(parent && $scope.folder && $scope.folder.id === parent.id) $scope.grid.setPage('first');
                    modals.get('cms.files.create').hide();
                });
            },
            item: {
                name:'',
                isFile: false,
                type:'Folder'
            }
        });
    };
    
    $scope.tree.removeModal = function(item){
        modals.create({
            id:'cms.folders.remove',
            title:'Remove Folder',
            text:'This will remove all files/folders inside. Are you sure ?',
            buttons:[
                { text:'Cancel', css:'btn btn-default', disabled:false, click: function(){ modals.get('cms.folders.remove').hide(); } },
                { text:'Delete', css:'btn btn-danger', disabled:false ,click: function(){
                        $scope.tree.removeItem(item, function(){
                            modals.get('cms.folders.remove').hide();
                            if(!$scope.folder || $scope.folder.id===item.id || ($scope.folder.ancestors||[]).indexOf(item.id)>-1) $scope.folder = { id:null };
                        });
                    }
                }
            ]
        });
    };
    
    $scope.editorModal = function(item){
        cms.files.read(item.id, { toString:true }, function(data){
            item.modifiedDT = data.modifiedDT; // sync modifiedDT
            modals.create({
                id: 'cms.files.edit',
                wide: true,
                title: local.translate('Edit File') + ' ' + item.id,
                include: 'views/cms-files-edit.html',
                item: item,
                mode: getAceType((item.ext||'').toLowerCase()),
                height: $window.innerHeight - 200,
                content: data.content,
                updateAndClose: function(){
                    cms.files.write({ id:this.item.id, modifiedDT:this.item.modifiedDT }, this.content, function(data){
                        item.modifiedDT = data.modifiedDT; // sync modifiedDT
                        notify.success('File Updated');
                        modals.get('cms.files.edit').hide();
                    });
                },
                update: function(){
                    cms.files.write({ id:this.item.id, modifiedDT:this.item.modifiedDT }, this.content, function(data){
                        item.modifiedDT = data.modifiedDT; // sync modifiedDT
                        notify.success('File Updated');
                    });
                }
            });
        });    
    };
    
    function getAceType(ext){
        if(ext==='js') return 'javascript';
        if(ext==='json') return 'json';
        if(ext==='jade') return 'jade';
        if(ext==='css') return 'css';
        if(ext==='md') return 'markdown';
        if(ext==='html') return 'html';
        if(ext==='xml') return 'xml';
        
        return 'text';
    }
    
    $scope.decideShow = function(item){
        if(item.$type) return item.$type;
        var ext = (item.ext||'').toLowerCase();
        
        if(['jpg','jpeg','png','gif','bmp','ico'].indexOf(ext)>-1){ // this is image
            if(item.size<=70000) item.$type = 'small_image';
        }
        else if(['js','css','html','xml','json','less','md','txt','old'].indexOf(ext)>-1){ // editable resource
            if(item.size<=200000) item.$type = 'editable_file';
        }
        else item.$type = 'noneditalbe_file';
        
        return item.$type;
    };
    
    $scope.getFileIcon = function(item){
        if(item.$icon) return item.$icon;
        var ext = (item.ext||'').toLowerCase();
        
        if(['jpg','jpeg','png','gif','bmp','ico','tiff'].indexOf(ext)>-1) item.$icon = 'fa-file-image-o';
        else if(['pdf'].indexOf(ext)>-1) item.$icon = 'fa-file-pdf-o';
        else if(['xls','xlsx'].indexOf(ext)>-1) item.$icon = 'fa-file-excel-o';
        else if(['doc','docx'].indexOf(ext)>-1) item.$icon = 'fa-file-word-o';
        else if(['ppt','pptx'].indexOf(ext)>-1) item.$icon = 'fa-file-powerpoint-o';
        else if(['zip','rar','gz'].indexOf(ext)>-1) item.$icon = 'fa-file-archive-o';
        else if(['mp3','waw'].indexOf(ext)>-1) item.$icon = 'fa-file-audio-o';
        else if(['mp4','wmv','mk4','avi','mov'].indexOf(ext)>-1) item.$icon = 'fa-file-video-o';
        
        else if(['txt','old'].indexOf(ext)>-1) item.$icon = 'fa-file-text-o';
        else if(['html','xml','css','less','md'].indexOf(ext)>-1) item.$icon = 'fa-file-code-o';
        else if(['js','json'].indexOf(ext)>-1) item.$icon = 'fa-file-text';
        
        else item.$icon = 'fa-file-o';
        
        return item.$icon;
    };
}])
.controller('CmsTemplatesCtrl', ['$scope','$window','$timeout', 'neCms', 'NeTree', 'neNotifications', 'neModals','neJsonHelpers','neColorPalette256', 'neFontAwesomeIcons', function($scope, $window, $timeout, cms, Tree, notify, modals, json, palette256, faIcons){
    
    $scope.faIcons = faIcons;    
    $scope.palette256 = palette256;
    $scope.height = $window.innerHeight - 200;
    $scope.template = {}; // focused template
    
    // publish jsonHelpers service
    $scope.json = json;
    
    $scope.tree = new Tree({
        id: 'cms.templates',
        resource: cms.templates,
        autoLoad: true,
        defaultSort:{ isDir:-1 },
        limit: 10,
        defaultQuery:{ $or:[{ext:'html'},{isDir:true}] },
        ancestorsReferenceKey:'ancestors',
        itemTemplate: 'views/cms-templates-item.html',
        onFocus:function(item){
            cms.templates.content(item.id, function(data){
                item.modifiedDT = data.modifiedDT; // update modifiedDT
                $scope.template.id = item.id;
                $scope.template.baseProp = data.baseProp;
                $scope.template.name = data.name;
                $scope.template.icon = data.icon;
                $scope.template.color = data.color;
                $scope.template.description = data.description;
                
                $scope.template.allowedChildTemplates = data.allowedChildTemplates;
                $scope.allowedTemplatesTree.allowedChildTemplates = $scope.template.allowedChildTemplates;
                
                $scope.template.html = data.html;
                $scope.template.controller = data.controller;
                $scope.template.editors = data.editors;
                $scope.template.view_mapping = data.view_mapping;
                $scope.template.parse_mapping = data.parse_mapping;
                $scope.template.parser = data.parser;
                $scope.template.attributes = data.attributes || [];
                
                $scope.template.$isValid = true;
                $timeout(function(){ $scope.$broadcast('neCms:templateChanged'); });
            });
        }
    }).load();
    
    $scope.allowedTemplatesTree = new Tree({
        id: 'cms.allowedTemplates',
        resource: cms.templates,
        autoLoad: true,
        defaultSort:{ isDir:-1 },
        limit: 10,
        defaultQuery:{ $or:[{ext:'html'},{isDir:true}] },
        ancestorsReferenceKey:'ancestors',
        itemTemplate: 'views/cms-templates-allowed-item.html',
        onFocus:function(item){
            $scope.template.allowedChildTemplates = $scope.template.allowedChildTemplates || [];
            $scope.template.allowedChildTemplates.push(item.id);
            $scope.allowedTemplatesTree.allowedChildTemplates = $scope.template.allowedChildTemplates;
        }
    });
    
    $scope.updateTemplate = function(){
        $scope.$broadcast('neCms:templateUpdate');
        
        $timeout(function(){
            var tmpl = angular.copy($scope.template);
            tmpl.modifiedDT = $scope.tree.focusedItem.modifiedDT;
            
            cms.templates.updateContent(tmpl, function(data){
                notify.success('Template Updated');
                $scope.tree.focusedItem.modifiedDT = data.modifiedDT;
            });
        });
    };
    
    $scope.tree.createModal = function(parent){
        modals.create({
            id:'cms.templates.create',
            title:'Create Template',
            include:'views/cms-templates-create.html',
            create: function(item){
                $scope.tree.createItem(parent, {
                    id: (parent ? parent.id +'/'+ item.id : item.id)+(item.isFile ? '.html' : '')
                }, true, function(){
                    modals.get('cms.templates.create').hide();
                });
            },
            item: {
                type:'File',
                isFile:true,
                isDir:false
            }
        });
    };
    
    $scope.tree.removeModal = function(item){
        modals.create({
            id:'cms.templates.remove',
            title:'Remove Template',
            text:'This will permanently remove template. Are you sure ?',
            buttons:[
                { text:'Cancel', css:'btn btn-default', disabled:false, click: function(){ modals.get('cms.templates.remove').hide(); } },
                { text:'Delete', css:'btn btn-danger', disabled:false ,click: function(){
                        $scope.tree.removeItem(item, function(){
                            modals.get('cms.templates.remove').hide();
                            if($scope.template && $scope.template.id===item.id) $scope.template.id = null;
                            $timeout(function(){ $scope.$broadcast('neCms:templateChanged'); });
                        });
                    }
                }
            ]
        });
    };
    
}])
.factory('neHtmlParser',['$document', function($document){
    
    // cache iframe if content is same
    var prevHtmlString;
    
    function createSandbox(htmlString){
        var iframeElm, iframeDoc;
        
        if(htmlString === prevHtmlString) {
            var iframeElm = $document.find('#htmlParser');
            iframeDoc = iframeElm[0].contentDocument || iframeElm[0].contentWindow.document;
            return angular.element(iframeDoc);
        }
        
        prevHtmlString = htmlString;
        
        // remove old sandbox iframe
        $document.find('#htmlParser').remove();
        
        // create new sandbox iframe
        iframeElm = angular.element('<iframe id="htmlParser" style="display:none;" sandbox="allow-same-origin"></iframe>');
        $document.find('body').eq(0).append(iframeElm);
        iframeDoc = iframeElm[0].contentDocument || iframeElm[0].contentWindow.document;
        
        iframeDoc.open();
        try { iframeDoc.write(htmlString); } catch(err){ }
        iframeDoc.close();
        return angular.element(iframeDoc);
    }
    
    this.count = function(htmlString, selector){
        try {
            return createSandbox(htmlString).find(selector).length;
        }
        catch(err){
            return 0;
        }
    };
    
    return this;
}])
.directive('neTemplateEditorsEditor',['$window','$rootScope','neObject','neJsonHelpers', 'neHtmlParser', function($window, $rootScope, object, json, htmlParser) {
    return {
        restrict: 'A',
        scope:{
            editorsOriginal:'=neTemplateEditorsEditor',
            editAsJson:'=',
            templateHtml:'=',
            templateIsValid:'='
        },
        templateUrl:'views/cms-templates-editors.html',
        link: function(scope, element, attr) {
            
            scope.cmsContentEditors = $rootScope.cmsContentEditors;
            scope.cmsOptionEditors = $rootScope.cmsOptionEditors;
            scope.height = $window.innerHeight - 200;
            
            // publish jsonHelpers
            scope.json = json;
            
            scope.$on('neCms:templateUpdate', function(){
                scope.cleanEditors();
            });
            
            scope.$on('neCms:templateChanged', function(){
                scope.fillEditors(scope.editorsOriginal);
            });
            
            scope.$watch('editAsJson', function(newValue, oldValue){
                if(typeof newValue === 'boolean') scope.cleanEditors(!newValue);
            });
            
            // prepare editors object to view in UI
            scope.fillEditors = function(editors){
                if(editors && typeof editors === 'string'){
                    scope.editorsOriginal = json.parse(editors);
                }
                
                scope.editorsString = json.pretty(scope.editorsOriginal, true);
                scope.editors = [];
                
                for(var key in (scope.editorsOriginal||{})) scope.editors.push({
                    selector: key,
                    group: (scope.editorsOriginal[key]||{}).group,
                    disabled: (scope.editorsOriginal[key]||{}).disabled,
                    editors: (function(obj){
                        var result = {};
                        for(var key in obj) if(key!=='group' && key!=='disabled') result[key] = json.pretty(obj[key], true);
                        return result;
                    })(scope.editorsOriginal[key])
                });
                scope.checkSelectors(scope.editors);
            };
            
            
            // clean up attributes modified by editors to store in DB
            scope.cleanEditors = function(editAsJson){
                editAsJson = editAsJson===undefined ? scope.editAsJson : editAsJson;
                
                if(editAsJson){ // json editor opened
                    try {
                        scope.editorsOriginal = JSON.parse(scope.editorsString);
                        scope.fillEditors(scope.editorsOriginal);
                    }
                    catch(err){
                        scope.editorsOriginal = {};
                    }
                }
                else { // ui editor
                    scope.editorsOriginal = {};
                    for(var i=0;i<scope.editors.length;i++) {
                        scope.editorsOriginal[ scope.editors[i].selector ] = {};
                        for(var key in scope.editors[i].editors){
                            scope.editorsOriginal[ scope.editors[i].selector ][key] = angular.fromJson(scope.editors[i].editors[key]);
                        }
                        scope.editorsOriginal[ scope.editors[i].selector ].group = scope.editors[i].group;
                        scope.editorsOriginal[ scope.editors[i].selector ].disabled = scope.editors[i].disabled;
                    }
                    scope.fillEditors(scope.editors);
                }
                
                // finally check if editors settings are valid
                scope.checkEditorsValidity();
            };
            
            scope.checkEditorsValidity = function(editorsString){
                scope.editorsString = editorsString || scope.editorsString;
                
                var valid = true; 
                for(var i=0;i<(scope.editors||[]).length;i++){
                    if(scope.editors[i].$invalid) {
                        valid = false;
                        break;
                    }
                    
                    for(var key in (scope.editors[i] || {})) {
                        if((scope.editors[i][key]||{}).$invalidSettings) {
                            valid = false;
                            break;
                        }
                    }
                }
                if(scope.editAsJson && valid) valid = json.isValid(scope.editorsString);
                scope.templateIsValid = valid;
                return valid;
            };
            
            scope.checkSelector = function(e){
                if(!e) return;
                
                if(e.selector) {
                    e.$invalid = false;
                    e.$dupliciteSelector = false;
                    var selectors = {};
                    for(var i=0;i<scope.editors.length;i++){
                        scope.editors[i].$dupliciteSelector = false;
                        if(scope.editors[i].selector) scope.editors[i].$invalid = false;
                        
                        var slc = scope.editors[i].selector;
                        selectors[ slc ] = selectors[ slc ] || [];
                        selectors[ slc ].push(scope.editors[i]);
                        
                        if(selectors[ slc ].length>1){
                            for(var s=0;s<selectors[ slc ].length;s++){
                                scope.editors[s].$dupliciteSelector = true;
                                scope.editors[s].$invalid = true;
                            }
                        }
                    }
                    selectors = null;
                    
                    if(!e.$dupliciteSelector) e.$selectionLength = htmlParser.count(scope.templateHtml, e.selector);
                }
                else e.$invalid = true;
            };
            
            scope.checkSelectors = function(editors){
                for(var i=0;i<editors.length;i++) scope.checkSelector(editors[i]);
            };
            
            scope.checkEditorSettings = function(e, key){
                e[key] = e[key] || {};
                if(!json.isValid(e.editors[key])) e[key].$invalidSettings = true;
                else delete e[key].$invalidSettings;
            };
            
            scope.duplicateEditor = function(e, index){
                var newE = angular.copy(e);
                scope.editors.splice(index, 0, newE);
                scope.checkSelector(newE);
            };
            
            scope.deleteKey = function(obj, key){
                delete obj[key];
            };
            
            // init editors UI
            scope.fillEditors(scope.editorsOriginal);
        }
    };
}])
.directive('neTemplateAttributesEditor',['$window','$rootScope','neObject','neJsonHelpers', function($window, $rootScope, object, json) {
    return {
        restrict: 'A',
        scope:{
            attributesOriginal:'=neTemplateAttributesEditor',
            editAsJson:'=',
            templateHtml:'=',
            templateBaseProp:'=',
            templateIsValid:'='
        },
        templateUrl:'views/cms-templates-attributes.html',
        link: function(scope, element, attr) {
            
            scope.propertySuggestions = [
                '{' +scope.templateBaseProp+ '}',
                '{container_id}'
            ];
            
            scope.cmsAttributeEditors = $rootScope.cmsAttributeEditors;
            scope.cmsOptionEditors = $rootScope.cmsOptionEditors;
            scope.height = $window.innerHeight - 200;
            
            // publish jsonHelpers
            scope.json = json;
            
            scope.$on('neCms:templateUpdate', function(){
                scope.cleanAttributes();
            });
            
            scope.$on('neCms:templateChanged', function(){
                scope.fillAttributes(scope.attributesOriginal);
            });
            
            scope.$watch('editAsJson', function(newValue, oldValue){
                if(typeof newValue === 'boolean') scope.cleanAttributes(!newValue);
            });
            
            // prepare attributes object to view editors UI
            scope.fillAttributes = function(attributes){
                if(attributes && typeof attributes === 'string'){
                    scope.attributes = json.parse(attributes);
                }
                
                scope.attributesString = json.pretty(scope.attributesOriginal, true);
                scope.attributes = angular.copy(scope.attributesOriginal);
                for(var i=0;i<scope.attributes.length;i++) {
                    scope.attributes[i].settings =  json.stringify(scope.attributes[i].settings || scope.cmsOptionEditors[ scope.attributes[i].editor ].settings);
                }
            };
            
            // clean up attributes modified by editors to store in DB
            scope.cleanAttributes = function(editAsJson){
                editAsJson = editAsJson===undefined ? scope.editAsJson : editAsJson;
                
                if(editAsJson){ // json editor opened
                    try {
                        scope.attributesOriginal = JSON.parse(scope.attributesString);
                        scope.fillAttributes(scope.attributesOriginal);
                    }
                    catch(err){
                        scope.attributesOriginal = [];
                    }
                }
                else { // ui editor
                    scope.attributesOriginal = angular.copy(scope.attributes);
                    for(var i=0;i<scope.attributesOriginal.length;i++) {
                        scope.attributesOriginal[i].settings = json.parse(scope.attributesOriginal[i].settings);
                    }
                    scope.fillAttributes(scope.attributes);
                }
                
                // finally check if attributes settings are valid
                scope.checkAttributesValidity();
            };
            
            scope.moveSkipGroup = function(a, fromIndex, toIndex){
                if(scope.attributes[ toIndex ] &&
                   scope.attributes[ toIndex ].grouped){
                    
                    var group = scope.attributes[ toIndex ].group;
                    if(a.grouped && group === a.group) moveAttribute(fromIndex, toIndex, a); // moving inside same group
                    
                    else {
                        for(var i=0;i<(scope.attributes||[]).length;i++){
                            if(scope.attributes[i].grouped && scope.attributes[i].group===group) {
                                toIndex = i+0;
                                if(fromIndex > toIndex) break; // moving up, need to skip till start of group
                                // else // moving down, need to skip till end of group
                            }
                        }
                        moveAttribute(fromIndex, toIndex, a);
                    }
                }
                else moveAttribute(fromIndex, toIndex, a); // no needed to skip
            };
           
            scope.duplicateAttribute = function(a, index){
                var newAttribute = angular.copy(a);
                scope.attributes.splice(index, 0, newAttribute);
                scope.checkProp(a);
            };
            
            scope.checkAttributesValidity = function(attributesString){
                scope.attributesString = attributesString || scope.attributesString;
                
                var valid = true; 
                for(var i=0;i<(scope.attributes||[]).length;i++){
                    if(scope.attributes[i].$invalidProp || scope.attributes[i].$invalidSettings) {
                        valid = false;
                        break;
                    }
                }
                if(scope.editAsJson && valid) valid = json.isValid(scope.attributesString);
                scope.templateIsValid = valid;
                return valid;
            };
           
            scope.checkProp = function(a){
                if(scope.isInvalidProp(a)) a.$invalidProp = true;
                else delete a.$invalidProp;
                scope.checkAttributesValidity();
            };
           
            scope.checkSettings = function(a){
                if(!json.isValid(a.settings)) a.$invalidSettings = true;
                else delete a.$invalidSettings;
                scope.checkAttributesValidity();
            };
           
            scope.isInvalidProp = function(a){
                var props = {};
                if(!a.propName || a.propName.match(/(\s|\$)/g) || a.propName.match(/^\./g) || a.propName.match(/\.$/g)) return true;
                
                if(a.isList && a.grouped) {
                    if(a.propName.split('.') < 2) return true;
                    if(a.propName.indexOf(a.listProp+'.')!==0) return true;
                }
                
                for(var i=0;i<(scope.attributes||[]).length;i++){
                    if(scope.attributes[i].propName === a.propName &&
                       props[ scope.attributes[i].propName ]) return true;
                    else props[ scope.attributes[i].propName ] = true;
                }
                return false;
            };
            
            scope.countGroup = function(group){
                var count = 0;
                for(var i=0;i<(scope.attributes||[]).length;i++){
                    if(scope.attributes[i].grouped && scope.attributes[i].group===group) count++;
                }
                return count;
            };
           
            scope.isInGroup = function(a, index){
                return  a.grouped &&
                        scope.attributes[index-1] &&
                        scope.attributes[index-1].grouped &&
                        scope.attributes[index-1].group === a.group;
            };
            
            scope.isFirstInGroup = function(a, index){
                return  a.grouped &&
                        !(scope.attributes[index-1] &&
                        scope.attributes[index-1].grouped &&
                        scope.attributes[index-1].group === a.group);
            };
           
            scope.isLastInGroup = function(a, index){
                return  a.grouped &&
                        !(scope.attributes[index+1] &&
                        scope.attributes[index+1].grouped &&
                        scope.attributes[index+1].group === a.group);
            };
           
            scope.groupList = function(group, isList){
                var listProp;
                for(var i=0;i<(scope.attributes||[]).length;i++){
                    if(scope.attributes[i].grouped && scope.attributes[i].group===group) {
                        scope.attributes[i].isList = isList;
                        if(!listProp) listProp = scope.getListProp(scope.attributes[i]);
                        scope.attributes[i].listProp = listProp;
                    }
                }
            };
           
            scope.applyGrouping = function(a,index){
                var firstMember, firstIndex, lastMember, lastIndex;
                for(var i=0;i<(scope.attributes||[]).length;i++){
                    if(scope.attributes[i]!==a && scope.attributes[i].grouped && scope.attributes[i].group===a.group) {
                        if(!firstMember) {
                            firstMember = scope.attributes[i];
                            firstIndex = i+0;
                        }
                        lastMember = scope.attributes[i];
                        lastIndex = i+0;
                    }
                }
                
                if(a.grouped) { // add to group
                    if(firstMember){
                        //if(index < firstIndex) moveAttribute(index, firstIndex, a);
                        //else moveAttribute(index, lastIndex+1, a);
                        
                        moveAttribute(index, lastIndex+1, a);
                        if(firstIndex) a.isList = firstMember.isList; // inherit isList from firstMember
                    }
                }
                else { // remove from group
                    //if(firstMember && index-firstIndex >= lastIndex-index) moveAttribute(index, firstIndex, a);
                    //else if(firstMember && index-firstIndex <= lastIndex-index) moveAttribute(index, lastIndex+1, a);
                    if(lastMember) moveAttribute(index, lastIndex + (lastIndex < index ? 1 : 0), a);
                }
            };
            
            scope.getListProp = function(a){
                if(!a.isList) return '';
                if(!a.grouped) return a.propName;
                var listProp = (a.propName||'').split('.')
                listProp.pop();
                return listProp.join('.');
            };
            
            scope.assignListProp = function(a, index){
                if(a.isList && a.grouped){
                    if(scope.isFirstInGroup(a, index)){
                        a.listProp = scope.getListProp(a);
                        for(var i=0;i<(scope.attributes||[]).length;i++){
                            if(scope.attributes[i].isList && scope.attributes[i].grouped && scope.attributes[i].group===a.group) {
                                scope.attributes[i].listProp = a.listProp;
                            }
                        }
                    }
                }
                else a.listProp = scope.getListProp(a);
            };
            
            function moveAttribute(fromIndex, toIndex, a){
                if(!scope.attributes) return;
                scope.attributes.splice(fromIndex, 1);
                scope.attributes.splice(toIndex+(fromIndex < toIndex ? 0 : 0),0,a);
            }
            
            // fill attributes UI
            scope.fillAttributes(scope.attributesOriginal);
        }
    }
}])
.directive('neTemplateMappingEditor',['$window', '$timeout', 'neObject', 'neJsonHelpers', 'neHtmlParser', function($window, $timeout, object, json, htmlParser) {
    return {
        restrict: 'A',
        scope:{
            mappingOriginal:'=neTemplateMappingEditor',
            editAsJson:'=',
            templateHtml:'=',
            templateBaseProp:'=',
            templateIsValid:'=',
            parentMapping:'=',
            parentSelector:'='
        },
        templateUrl:'views/cms-templates-mapping.html',
        link: function(scope, element, attr, ctrl) {
            
            scope.propertySuggestions = scope.parentMapping ? null : [
                'content',
                'attributes',
                '{' +scope.templateBaseProp+ '}',
                '{container_id}',
                'JSON(model_prop)',
                'title',
                'url',
                'urlName',
                'createdDT',
                'modifiedDT',
                'published'
            ];
            
            scope.classNameSuggestions = [
                'PREFIX(some-prefix-)',
                'SUFFIX(-some-suffix)'
            ];
            
            scope.height = $window.innerHeight - 200;
            
            // publish jsonHelpers
            scope.json = json;
            
            if(!scope.parentMapping) { // parent editor
                scope.$on('neCms:templateUpdate', function(){
                    scope.cleanMapping();
                });
                
                scope.$on('neCms:templateChanged', function(){
                    fillMapping(scope.mappingOriginal);
                });
                
                scope.$watch('editAsJson', function(newValue, oldValue){
                    if(typeof newValue === 'boolean') {
                        scope.cleanMapping(!newValue);
                    }
                });
                
            }
            else { // inside nested
                //scope.mappingOriginal = scope.parentMapping.inside;
                
                scope.$watch('mapping', function(newValue, oldValue){
                    scope.cleanMapping(false, true);
                    //scope.parentMapping.inside = scope.mappingOriginal;
                }, true);
            }
            
            
            // prepare attributes object to view editors UI
            function fillMapping(mapping){
                if(mapping && typeof mapping === 'string'){ // filling from mappingOriginal
                    mapping = json.parse(mapping);
                }
                scope.mappingString = json.pretty(mapping, true);
                
                var mapArray = [];
                for(var key in mapping) {
                    
                    mapArray.push({
                        selector: key,
                        htmlKey: mapping[key].html,
                        attrs: (function(attrs){
                            var result = [];
                            if(attrs && angular.isObject(attrs)) {
                                for(var name in attrs) {
                                    if((name === 'style' || name === 'class') && angular.isObject(attrs[name])){
                                        result.push({
                                            type:name,
                                            name:name,
                                            value:(function(value){
                                                var result = [];
                                                for(var key in value) result.push({ name:key, value:value[key] });
                                                return result;
                                            })(attrs[name])
                                        });
                                    }
                                    else result.push({ type:'simple', name:name, value:attrs[name] });
                                }
                            }
                            return result;
                        })(mapping[key].attrs),
                        repeatKey: mapping[key].repeat,
                        inside: mapping[key].inside
                    });
                }
                
                scope.mapping = mapArray;
                scope.checkSelectors(scope.mapping);
            }
            
            
            // clean up mapping modified by editors to store in DB
            scope.cleanMapping = function(editAsJson, dontRefill){
                editAsJson = editAsJson===undefined ? scope.editAsJson : editAsJson;
                
                if(editAsJson){ // json editor opened
                    try {
                        scope.mappingOriginal = json.parse(scope.mappingString);
                        fillMapping(scope.mappingOriginal);
                    }
                    catch(err){
                        scope.mappingOriginal = '{}';
                        fillMapping(scope.mappingOriginal);
                    }
                }
                else { // ui editor
                    scope.mappingOriginal = {};
                    for(var i=0;i<scope.mapping.length;i++) {
                        var m = scope.mapping[i];
                        if(m.selector) scope.mappingOriginal[ m.selector ] = {
                            html: m.htmlKey || undefined,
                            attrs: (function(attrs){
                                
                                if(!attrs || !Array.isArray(attrs) || !attrs.length) return undefined;
                                var result = {};
                                for(var a=0;a<attrs.length;a++) {
                                    if(attrs[a].name && attrs[a].value) {
                                        if(attrs[a].type==='simple') result[ attrs[a].name ] = attrs[a].value;
                                        else result[ attrs[a].type ] = (function(value){
                                            var result = {};
                                            for(var i=0;i<value.length;i++) result[value[i].name] = value[i].value;
                                            return result;
                                        })(attrs[a].value);
                                    }
                                }
                                return result;
                            
                            })(m.attrs),
                            repeat: m.repeatKey || undefined,
                            inside: m.inside
                        };
                    }
                    
                    // fill mapping to ensure both, json and UI is updated
                    if(!dontRefill) fillMapping(scope.mappingOriginal);
                }
                
                // finally check if attributes settings are valid
                if(!dontRefill) scope.checkMappingValidity();
            };
            
            scope.checkMappingValidity = function(mappingString){
                scope.mappingString = mappingString || scope.mappingString;
                
                var valid = true; 
                for(var i=0;i<(scope.mapping||[]).length;i++){
                    if(scope.mapping[i].$invalid) {
                        valid = false;
                        break;
                    }
                    
                    //for(var key in (scope.mapping[i] || {})) {
                    //    if((scope.mapping[i][key]||{}).$invalidSettings) {
                    //        valid = false;
                    //        break;
                    //    }
                    //}
                }
                if(scope.editAsJson && valid) valid = json.isValid(scope.mappingString);
                scope.templateIsValid = valid;
                return valid;
            };
            
            scope.checkSelector = function(m, mappings){
                if(!m) return;
                
                mappings = mappings || scope.mapping;
                
                if(m.selector) {
                    m.$invalid = false;
                    m.$dupliciteSelector = false;
                    var selectors = {};
                    for(var i=0;i<mappings.length;i++){
                        mappings[i].$dupliciteSelector = false;
                        if(mappings[i].selector) mappings[i].$invalid = false;
                        
                        var slc = (scope.parentSelector||'') + ' ' + mappings[i].selector;
                        selectors[ slc ] = selectors[ slc ] || [];
                        selectors[ slc ].push(mappings[i]);
                        
                        if(selectors[ slc ].length>1){
                            for(var s=0;s<selectors[ slc ].length;s++){
                                mappings[s].$dupliciteSelector = true;
                                mappings[s].$invalid = true;
                            }
                        }
                    }
                    selectors = null;
                    
                    if(!m.$dupliciteSelector) m.$selectionLength = htmlParser.count(scope.templateHtml, (scope.parentSelector||'') + ' ' + m.selector);
                }
                else m.$invalid = true;
            };
            
            scope.checkSelectors = function(mappings){
                for(var i=0;i<mappings.length;i++) {
                    scope.checkSelector(mappings[i]);
                }
            };
            
            scope.deleteKey = function(obj, key){
                delete obj[key];
            };
            
            scope.duplicate = function(m, index, mapping){
                var newM = angular.copy(m);
                mapping.splice(index, 0, newM);
                scope.checkSelector(newM, mapping);
            };
            
            scope.keysLength = function(obj){
                if(!obj) return 0;
                return Object.keys(obj).length;
            };
            
            // class and style attribute can be used only once
            scope.availableAttrTypes = function(m){
                if(!Array.isArray(m.attrs)) m.attrs = [];
                
                // allowed attribute types
                var result = [ 'simple', 'class', 'style' ];
                
                for(var i=0;i<m.attrs.length;i++){
                    if(m.attrs[i].type === 'class') result.splice( result.indexOf('class'), 1 );
                    if(m.attrs[i].type === 'style') result.splice( result.indexOf('style'), 1 );
                }
                return result;
            };
            
            // fill editors UI
            fillMapping(scope.mappingOriginal);
        }
    };
}])
.directive('neEditableIframe', ['neLoading', 'neEditable', function(loading, editable){
    return {
        restrict:'A',
        link: function(scope, elm, attrs, ctrl){
            var first_time = true;
            var isLoading = false;
            
            attrs.$observe('src', function(){
                // show loading
                if(!isLoading) loading.reqStarted();
                first_time = false;
                isLoading = true;
            });
            
            elm.on('load', onLoad);
            function onLoad(){
                if(!this.contentWindow.document.body) return;
                
                editable.bind(this.contentWindow.document);
                if(isLoading) loading.reqEnded();
                isLoading = false;
                
                // auto adjust height to content of iframe
                this.contentWindow.document.body.style.margin = '0px';
                this.contentWindow.document.body.style.border = 'none';
                this.style.height = '10px';
                this.style.height = this.contentWindow.document.body.scrollHeight + 0 + 'px';
            }
            
            var resizeMaxTry = 2,
                resizeWaitTime = 300,
                minimumHeight = 150,
                defaultHeight = 160,
                heightOffset = 25,
                watcherTime = 700,
                resizeCount = 0,
                resizeTimeout;
            
            
            function resizeIframe(){
                if(!elm.get(0) || !((elm.get(0).contentWindow||{}).document||{}).body) return;
                
                resetIframe();
                if(elm.css('height') === minimumHeight+'px') {
                    resetIframe();
                }
                
                var pageHeight = angular.element(elm.get(0).contentWindow.document).height();
                
                if(pageHeight+heightOffset <= minimumHeight) tryFixIframe();
                else if (pageHeight > minimumHeight) setIframeHeight(pageHeight + heightOffset);
            }
            function setIframeHeight(height) {
                if(elm.css('height') !== height+'px'){
                    elm.height(height).css('height', height);
                    elm.parent().css('height', height);
                }
            }
            function resetIframe(){
                elm.css('height','').removeAttr('height');
            }
            function tryFixIframe(){
                if(resizeCount <= resizeMaxTry){
                    resizeCount++;
                    resizeTimeout = setTimeout(resizeIframe, resizeWaitTime);
                }
                else {
                    clearTimeout(resizeTimeout);
                    resizeCount = 0;
                    setIframeHeight(defaultHeight + heightOffset);
                }
            }
            
            //scope.$on('neEditable:updateElm', resizeIframe);
            //scope.$on('neEditable:createElm', resizeIframe);
            //scope.$on('neEditable:moveElm', resizeIframe);
            //scope.$on('neEditable:removeElm', resizeIframe);
            
            // check interval, because iframe content can change from inside
            var checkHeightInterval = setInterval(resizeIframe, watcherTime);
            
            scope.$on('neCms:pagerefresh', function(){
                if(!elm[0].contentWindow.document.body) return;
                elm[0].contentWindow.location.reload();
            });
            
            scope.$on('$destroy', function(){
                clearInterval(checkHeightInterval);
            });
            
            // run resize
            resizeIframe();
        }
    };    
}])
.controller('CmsDocumentsCtrl', ['$scope', '$location', 'neCms', 'neObject', 'neLocal', 'NeTree', 'neNotifications','neModals','neEditable','neColorPalette256','neFontAwesomeIcons',function($scope, $location, cms, object, local, Tree, notify, modals, editable, palette256, faIcons){
    
    $scope.tree = new Tree({
        id: 'cms.documents',
        resource: cms.documents,
        ancestorsReferenceKey:'ancestors',
        childrenCountKey:'childrenCount',
        autoLoad:true,
        defaultSort:{},
        limit:10,
        defaultQuery:{},
        itemTemplate: 'views/cms-documents-item.html',
        onFocus: function(item){
            if($scope.document === item) return;
            
            $scope.document = item;
            $scope.document.attributes = $scope.document.attributes || {};

            cms.templates.meta({id:item.template, documentId:item.id }, function(data){

                // extend mappings
                editable.mappings = extendMappings(data.mappings, $scope.document.templateSettings);
                editable.markNotDirty();
                //$scope.templateMeta = data;
                $scope.attributes = fillAttributes(editable.mappings[0].mapping.attributes||[], $scope.document.attributes);
                $scope.iframeUrl = 'cms/documents/'+item.id+'/render';
                $scope.$broadcast('neCms:pageChanged');
                $scope.widgets = null;
            });
        }
    }).load();
    
    $scope.tree.focusItemModal = function(item){
        if(!$scope.canUpdateDocument()) return $scope.tree.focusItem(item);
        if($scope.document === item) return;
        
        modals.create({
            id:'cms.documents.changed',
            title:'Document Changed',
            text:'Document Content Changed. Switch to another will discard all changes. Are you sure ?',
            buttons:[
                { text:'Cancel', css:'btn btn-default', disabled:false, click: function(){ 
                        modals.get('cms.documents.changed').hide();
                    } 
                },
                { text:'Continue Without Saving', css:'btn btn-primary', disabled:false ,click: function(){
                        modals.get('cms.documents.changed').hide();
                        $scope.tree.focusItem(item);
                    }
                },
                { text:'Save And Continue', css:'btn btn-primary', disabled:false ,click: function(){
                        $scope.updateDocument(function(){
                            modals.get('cms.documents.changed').hide();
                            $scope.tree.focusItem(item);
                        });
                    }
                }
            ]
        });
    };
    
    $scope.tree.dropBefore = function(target){
        if($scope.tree.$dragged.ancestors.join(',')!==target.ancestors.join(',') || target===$scope.tree.$dragged) return;
        var item = $scope.tree.$dragged;
        var itemToUpdate = angular.copy(item);
        itemToUpdate.sortOrder = target.sortOrder;
        
        // change document position
        cms.documents.position(itemToUpdate, function(data){
            angular.extend(item, data);
            var parent = $scope.tree.getParentOf(item);
            var itemIndex = parent ? parent.$children.indexOf(item) : $scope.tree.items.indexOf(item);
            var targetIndex = parent ? parent.$children.indexOf(target) : $scope.tree.items.indexOf(target);
            
            if(parent){
                parent.$children.forEach(function(ch){
                    if(ch!==item && ch.sortOrder >= item.sortOrder) ch.sortOrder++;
                });
                
                parent.$children.splice(itemIndex, 1);
                parent.$children.splice(targetIndex-(targetIndex > itemIndex ? 1 : 0), 0, item);
            }
            else {
                $scope.tree.items.forEach(function(ch){
                    if(ch!==item && ch.sortOrder >= item.sortOrder) ch.sortOrder++;
                });
                
                $scope.tree.items.splice(itemIndex, 1);
                $scope.tree.items.splice(targetIndex-(targetIndex > itemIndex ? 1 : 0), 0, item);
            }
        });
    };
    
    function getGroupMembers(attributes, group){
        var members = [];
        for(var i=0;i<attributes.length;i++){
            if(attributes[i].grouped && attributes[i].group === group) members.push(attributes[i]);
        }
        return members;
    }
    
    function getGroupProps(attributes, group){
        var props = {};
        for(var i=0;i<attributes.length;i++){
            if(attributes[i].grouped && attributes[i].group === group) props[ attributes[i].propName ] = true;
        }
        return props;
    }
    
    function createDisplayAttr(attribute){
        attribute = angular.copy(attribute);
        attribute.editor = typeof attribute.editor==='string' ? $scope.cmsAttributeEditors[ attribute.editor ] : attribute.editor;
        attribute.dirty = attribute.isDirty = false;
        attribute.invalid = false;
        
        return attribute;
    }
    
    function fillAttributes(attributes, attrValues, baseKey){
        var displayAttributes = [], displayAttr;
        baseKey = baseKey ? baseKey+='.' : '';
        
        for(var i=0;i<(attributes||[]).length;i++) {
            // skip disabled attributes
            if(attributes[i].disabled) continue;
            
            // in case simple attribute (not list, not grouped)
            if(!attributes[i].isList && !attributes[i].grouped){
                displayAttr = createDisplayAttr(attributes[i]);
                displayAttr.value = object.deepGet(attrValues, baseKey+attributes[i].propName);
                if(displayAttr.value === undefined) displayAttr.value = (attributes[i].settings||{}).value;
                displayAttributes.push(displayAttr);
            }
            
            // in case list, but not grouped
            else if(attributes[i].isList && !attributes[i].grouped) {
                var listItems = object.deepGet(attrValues, baseKey+attributes[i].listProp);
                if(!Array.isArray(listItems) || !listItems.length) listItems = [undefined];
                for(var li=0;li<listItems.length;li++){
                    displayAttr = createDisplayAttr(attributes[i]);
                    displayAttr.value = listItems[li];
                    if(displayAttr.value === undefined) displayAttr.value = (attributes[i].settings||{}).value;
                    displayAttributes.push(displayAttr);
                }
            }
            
            // in case grouped, but not list
            else if(!attributes[i].isList && attributes[i].grouped) {
                var groupProps = getGroupProps(attributes, attributes[i].group);
                var children = [];
                i--;
                
                for(var propName in groupProps){
                    i++; // skip to next grouped attribute
                    displayAttr = createDisplayAttr(attributes[i]);
                    displayAttr.value = object.deepGet(attrValues, baseKey+propName);
                    if(displayAttr.value === undefined) displayAttr.value = (attributes[i].settings||{}).value;
                    children.push(displayAttr);
                }
                displayAttributes.push({
                    children: children,
                    dirty: false,
                    isDirty: false,
                    invalid: false,
                    group: attributes[i].group,
                    isList: attributes[i].isList,
                    listProp: attributes[i].listProp
                });
            }
            
            // in case grouped and list
            else if(attributes[i].isList && attributes[i].grouped) {
                var listItems = object.deepGet(attrValues, baseKey+attributes[i].listProp);
                if(!Array.isArray(listItems) || !listItems.length) listItems = [undefined];
                var groupProps = getGroupProps(attributes, attributes[i].group);
                var parentIndex = i+0;
                
                for(var li=0;li<listItems.length;li++){
                    var children = [];
                    i = parentIndex-1;
                    for(var propName in groupProps){
                        i++; // skip to next grouped attribute
                        displayAttr = createDisplayAttr(attributes[i]);
                        displayAttr.value = object.deepGet(listItems[li], propName.substring(displayAttr.listProp.length+1));
                        if(displayAttr.value === undefined) displayAttr.value = (attributes[i].settings||{}).value;
                        children.push(displayAttr); 
                    }
                    displayAttributes.push({
                        children: children,
                        dirty: false,
                        isDirty: false,
                        invalid: false,
                        group: attributes[i].group,
                        isList: attributes[i].isList,
                        listProp: attributes[i].listProp
                    });
                }
            }
        }
        
        return displayAttributes;
    }
    
    $scope.refreshPage = function(){
        cms.templates.meta({ id:$scope.document.template, documentId:$scope.document.id }, function(data){
            
            // check ancestors, refuse refresh when ancestors changed,
            // means document changed position in tree, and whole tree have to be reloaded
            if($scope.document.ancestors.join(',') !== data.document.ancestors.join(',')) {
                return notify.warning('Document has changed position in sitemap tree, please RELOAD whole admin page');
            }
            
            $scope.document = angular.extend($scope.document, data.document);
            
            // extend mappings
            editable.mappings = extendMappings(data.mappings, $scope.document.templateSettings);
            
            editable.markNotDirty();
            //$scope.templateMeta = data;
            $scope.attributes = fillAttributes(editable.mappings[0].mapping.attributes||[], $scope.document.attributes);
            $scope.$broadcast('neCms:pagerefresh');
            $scope.widgets = null;
        });
    };
    
    function extendMappings(mappings, settings){
        settings = settings || {};
        var result = angular.copy(mappings||[]);
        for(var i=0;i<result.length;i++){
            var map = result[i].mapping;
            var set = settings[ mappings[i].id ]||{};
            
            // document.templateSettings example:
            // { 'laylouts/page.html':{ attributes:{ 'myattr':{ disabled:true } }, editors:{ 'selector':{ disabled:false } } } }
            
            // extend attributes
            if(set.attributes){
                for(var a=0;a<map.attributes.length;a++){
                    if(set.attributes[ map.attributes[a].propName ] && set.attributes[ map.attributes[a].propName ].disabled !== map.attributes[a].disabled){
                        map.attributes[a].disabled = set.attributes[ map.attributes[a].propName ].disabled;
                    }
                }
            }
            
            // extend editors
            if(set.editors){
                for(var selector in (map.editors||{})){
                    if(set.editors[ selector ] && set.editors[ selector ].disabled !== map.editors[ selector ].disabled){
                        map.editors[ selector ].disabled = set.editors[ selector ].disabled;
                    }
                }
            }
        }
        return result;
    }
    
    // publish sitemap tree via cms service, and remove on scope destroy 
    cms.sitemapTree = $scope.tree;
    $scope.$on('$destroy', function(){
        cms.sitemapTree = null;
    });
    
    $scope.tree.createModal = function(parent){
        if(!$scope.pages) cms.pages.find({}, function(data){
            $scope.pages = data;
            createModal(parent);
        });
        else createModal(parent);
    };
    
    function createModal(parent){
        var thisTemplate, allowedTemplateIds = [];
        
        if(parent){
            for(var i=0;i<$scope.pages.length;i++){
                if($scope.pages[i].id === parent.template) {
                    thisTemplate = $scope.pages[i];
                    break;
                }
            }

            for(var i=0;i<$scope.pages.length;i++){
                if(isAllowedTemplate( $scope.pages[i].id )) allowedTemplateIds.push( $scope.pages[i].id );
            }
        }
        else {
            for(var i=0;i<$scope.pages.length;i++) allowedTemplateIds.push( $scope.pages[i].id );
        }
        
        function isAllowedTemplate(id){
            if(!thisTemplate.allowedChildTemplates) return true;
            for(var i=0;i<thisTemplate.allowedChildTemplates.length;i++){
                if(id.indexOf( thisTemplate.allowedChildTemplates[i] ) === 0) return true;
            }
            return false;
        }
        
        modals.create({
            id:'cms.documents.create',
            title:'Create Document',
            include:'views/cms-documents-create.html',
            create: function(item){
                $scope.tree.createItem(parent, item, true, function(){
                    modals.get('cms.documents.create').hide();
                });
            },
            item: {},
            templates: $scope.pages,
            allowedTemplateIds: allowedTemplateIds,
            isAllowedTemplate: isAllowedTemplate
        });
    }
    
    $scope.securityModal = function(item){
        modals.create({
            id:'cms.documents.security',
            title:'Document Security Settings',
            include:'views/cms-documents-security.html',
            update: function(item){
                $scope.tree.updateItem(item, function(item){
                    modals.get('cms.documents.security').hide();
                });
            },
            item: item
        });
    };
    
    $scope.detailsModal = function(item){
        modals.create({
            id:'cms.documents.details',
            title:'Document Details',
            include:'views/cms-documents-details.html',
            update: function(item){
                $scope.tree.updateItem(item, function(item){
                    modals.get('cms.documents.details').hide();
                });
            },
            item: item,
            faIcons: faIcons,   
            palette256: palette256
        });
    };
    
    $scope.tempSettingsModal = function(item){
        // example of document.tempSettings:
        // { 'laylouts/page.html':{ attributes:{ 'myattr':{ disabled:true } }, editors:{ 'selector':{ disabled:false } } } }
        
        modals.create({
            id:'cms.documents.tempsettings',
            title:'Template Settings',
            include:'views/cms-documents-tempsettings.html',
            update: function(item){
                item.templateSettings = angular.copy(this.settings);
                $scope.tree.updateItem(item, function(item){
                    $scope.refreshPage();
                    modals.get('cms.documents.tempsettings').hide();
                });
            },
            item: item,
            mappings: angular.copy(editable.mappings),
            keys: function(obj){
                if(!obj) return '';
                return Object.keys(obj).join(',').replace('group','').replace('disabled','').replace(/,,/g,',')
            },
            settings: angular.copy(item.templateSettings||{}),
            attributeExtended: function(templateId, propName){
                return (this.settings[ templateId ] &&
                        ((this.settings[ templateId ].attributes||{})[ propName ]||{}).hasOwnProperty('disabled'));
            },
            editorExtended: function(templateId, selector){
                return (this.settings[ templateId ] &&
                        ((this.settings[ templateId ].editors||{})[selector]||{}).hasOwnProperty('disabled'));
            },
            toggleAttribute: function(templateId, propName, attr){
                var wasExtended = false;
                if(this.attributeExtended(templateId, propName)){
                    delete this.settings[templateId].attributes[propName].disabled; // delete ext prop
                    if(Object.keys(this.settings[templateId].attributes[propName]).length===0) delete this.settings[templateId].attributes[propName]; // delete propName if empty
                    if(Object.keys(this.settings[templateId].attributes).length===0) delete this.settings[templateId].attributes; // delete attributes if empty
                    if(Object.keys(this.settings[templateId]).length===0) delete this.settings[templateId]; // delete templateId if empty
                    wasExtended = true;
                }
                attr.disabled = !attr.disabled;
                if(!wasExtended){
                    this.settings[templateId] = this.settings[templateId] || {};
                    this.settings[templateId].attributes = this.settings[templateId].attributes || {};
                    this.settings[templateId].attributes[propName] = this.settings[templateId].attributes[propName] || {};
                    this.settings[templateId].attributes[propName].disabled = !!attr.disabled;
                }
            },
            toggleEditor: function(templateId, selector, editors){
                var wasExtended = false;
                if(this.editorExtended(templateId, selector)){
                    delete this.settings[templateId].editors[selector].disabled; // delete ext prop
                    if(Object.keys(this.settings[templateId].editors[selector]).length===0) delete this.settings[templateId].editors[selector]; // delete selector if empty
                    if(Object.keys(this.settings[templateId].editors).length===0) delete this.settings[templateId].editors; // delete editors if empty
                    if(Object.keys(this.settings[templateId]).length===0) delete this.settings[templateId]; // delete templateId if empty
                    wasExtended = true;
                }
                editors.disabled = !editors.disabled;
                if(!wasExtended){
                    this.settings[templateId] = this.settings[templateId] || {};
                    this.settings[templateId].editors = this.settings[templateId].editors || {};
                    this.settings[templateId].editors[selector] = this.settings[templateId].editors[selector] || {};
                    this.settings[templateId].editors[selector].disabled = !!editors.disabled;
                }
            }
        });
    };
    
    $scope.urlModified = function(){
        $scope.document.$editDetails = false;
        if($scope.document.$children) $scope.tree.loadItems($scope.document, true);
    };
                                
    $scope.getPreviewUrl = function(doc){
        if(!doc.published || $location.host().indexOf('localhost') === 0) return $scope.iframeUrl;
        else {
            var port = $location.port();
            if(port === 443 || port === 80) return doc.url;
            
            // get domain name
            var domain = (doc.url.match(/^\/\/([^\/])+/) || [])[0];
            if(domain) return doc.url.replace(domain, domain+':'+port);
            else return doc.url;
        }
    };
    
    $scope.tree.removeModal = function(item){
        modals.create({
            id:'cms.documents.remove',
            title:'Remove Document',
            text:'Are you sure ?',
            buttons:[
                { text:'Cancel', css:'btn btn-default', disabled:false, click: function(){ modals.get('cms.documents.remove').hide(); } },
                { text:'Delete', css:'btn btn-danger', disabled:false ,click: function(){
                        $scope.tree.removeItem(item, function(){
                            modals.get('cms.documents.remove').hide();
                            $scope.document = null;
                        });
                    }
                }
            ]
        });
    };
    
    $scope.editDetails = function(close){
        if(close){
            $scope.document.title = $scope.document.$title+'';
            $scope.document.urlName = $scope.document.$urlName+'';
            $scope.document.$editDetails = false;
        }
        else {
            $scope.document.$title = $scope.document.title+'';
            $scope.document.$urlName = $scope.document.urlName+'';
            $scope.document.$editDetails = true;
        }
    }
    
    // create editable container modal
    modals.create({
        id:'cms.editors',
        title:'Edit Content',
        include:'views/cms-editable-modal.html',
        showAfterCreate:false,
        removeOnClose:false,
        opacity:0.2,
        css:'left small',
        buttons:[
            { text:'Close', css:'btn btn-default', disabled:false, click: function(){ modals.get('cms.editors').hide(); } }
          //{ text:'Create', css:'btn btn-primary', disabled:sitemap.newDoc.isNotValid ,click:createChild(doc, $modal.hide) }
        ],
        onClose: function(){
            editable.unmarkSelected();
        }
    });
    
    $scope.$on('neEditable:focus', function(e, linkedSettings){
        modals.get('cms.editors').show();
    });
    
    $scope.attributesFormScope;
    $scope.setFormScope = function(scope){
        $scope.attributesFormScope = scope;
    }
    
    $scope.canUpdateDocument = function(){
        var isDirty = false;
        
        // do not hold form controller if form does not exists
        if(!($scope.attributesFormScope||{}).attributesForm) delete $scope.attributesFormScope;
        
        // check if child form is valid
        if($scope.attributesFormScope && !$scope.attributesFormScope.attributesForm.$valid) return false;
        
        for(var i=0;i<($scope.attributes||[]).length;i++){
            if($scope.isAttrInvalid($scope.attributes[i])) return false;
            if($scope.isAttrDirty($scope.attributes[i])) isDirty = true;
        }
        return (($scope.document||{}).attributes||{}).dirty || isDirty || editable.isDirty();
    };
    
    function setAttributes(displayAttrs, baseKey){
        var attributesDirty = false,
            groups = {},
            lists = {},
            attributes = angular.copy($scope.document.attributes);
        baseKey = baseKey ? baseKey+'.' : '';
        
        for(var i=0;i<(displayAttrs||[]).length;i++){
            var attr = displayAttrs[i];
            
            // if grouped
            if(attr.children) {
                if(attr.isList && !groups[ attr.group ]) attributes = object.deepSet(attributes, baseKey+attr.listProp, []); // empty array if list
                groups[ attr.group ] = true;
                var listItem = null;
                
                for(var c=0;c<attr.children.length;c++){
                    var child = attr.children[c];
                    if(attr.dirty || child.dirty) attributesDirty = true;
                    if(attr.isList) {
                        listItem = listItem || {};
                        listItem = object.deepSet(listItem, child.propName.substring(attr.listProp.length+1), child.value);
                    }
                    else attributes = object.deepSet(attributes, baseKey+child.propName, child.value);
                }
                if(listItem) attributes = object.deepSet(attributes, baseKey+attr.listProp, listItem, 'push');
            }
            
            // if list, not grouped
            else if(attr.isList) {
                if(!lists[ attr.listProp ]) attributes = object.deepSet(attributes, baseKey+attr.listProp, [attr.value]);
                else attributes = object.deepSet(attributes, baseKey+attr.listProp, attr.value, 'push');
                
                lists[ attr.listProp ] = true;
                if(attr.dirty || attr.isDirty) attributesDirty = true;
            }
            
            // if not grouped and not list
            else {
                attributes = object.deepSet(attributes, baseKey+attr.propName, attr.value);
                if(attr.dirty || attr.isDirty) attributesDirty = true;
            }
        }
        attributes.$dirty = attributes.$dirty || attributesDirty;
        return attributes;
    }
    
    $scope.updateDocument = function(cb){
        var attrs = setAttributes($scope.attributes);
        
        cms.documents.content({
            id: $scope.document.id,
            attributes: attrs.$dirty ? attrs : null,
            html: editable.isDirty() ? editable.getCleanHTML() : null,
            modifiedDT:$scope.document.modifiedDT
        }, function(data){
            notify.success('Document Updated');
            $scope.document.attributes = data.attributes;
            $scope.document.modifiedDT = data.modifiedDT;
            $scope.attributes = fillAttributes(editable.mappings[0].mapping.attributes, data.attributes); // refill values, and clear dirty marks
            editable.clearAllDirtyMarks();
            if(cb) cb();
        });
    };
    
    /*
     * Widgets Container
     */
    
    $scope.widgets = null;
    function createWidgetModal(containerId, widgets){
        modals.create({
            id:'cms.widgets.create',
            title: local.translate('Add Widgets Into Container') + ' "' +containerId+ '"',
            include:'views/cms-widgets-create.html',
            widgets: widgets,
            create: function(widget){
                cms.templates.meta({ id:widget.id, includeContent:true }, function(data){
                    var mappings = extendMappings(data.mappings, $scope.document.templateSettings);
                    editable.createWidget(containerId, widget.id, mappings[0].mapping, data.html);
                    modals.get('cms.widgets.create').hide();
                });
            }
        });
    }
    
    $scope.$on('neEditable:container', function(e, containerId, allowedWidgets){
        if(!$scope.widgets) cms.widgets.find({ widgets:allowedWidgets }, function(data){
            $scope.widgets = data;
            var widgets = [];
            if(!allowedWidgets.length) createWidgetModal(containerId, $scope.widgets);
            else {
                for(var i=0;i<data.length;i++) if(allowedWidgets.indexOf(data[i].id)>-1) widgets.push(data[i]);
                createWidgetModal(containerId, widgets);
            }
        });
        else if($scope.widgets && allowedWidgets.length) {
            var widgets = [];
            for(var i=0;i<$scope.widgets.length;i++) if(allowedWidgets.indexOf($scope.widgets[i].id)>-1) widgets.push($scope.widgets[i]);
            createWidgetModal(containerId, widgets);
        }
        else createWidgetModal(containerId, $scope.widgets);
    });
    
    /*
     * Widget Attributes
     */
    
    $scope.$on('neEditable:attributes', function(e, containerId, widgetId, templateId, num){
        var mapping = {};
        for(var i=0;i<editable.mappings.length;i++) {
            if(editable.mappings[i].id===templateId) {
                mapping = editable.mappings[i].mapping;
                break;
            }
        }
        var baseKey = (containerId ? containerId+'.' : '') + (widgetId || (templateId||'').replace(/^widgets\//,'').replace(/\.html$/,'').replace(/\//g,'_'));
        
        modals.create({
            id:'cms.widget.attributes',
            title:'Edit Widget Attributes',
            include:'views/cms-attributes-modal.html',
            mapping: mapping,
            attributes: fillAttributes(mapping.attributes, $scope.document.attributes, baseKey),
            update: function(){
                var attrs = setAttributes(this.attributes, baseKey);
                if(attrs.$dirty) {
                    $scope.document.attributes = attrs;
                    editable.markDirtyButton(templateId+num);
                }
                modals.get('cms.widget.attributes').hide();
            },
            allValid: function(attrs){
                for(var i=0;i<(attrs||[]).length;i++){
                    if($scope.isAttrInvalid(attrs[i])) return false;
                }
                return true;
            },
            isAttrDirty: $scope.isAttrDirty,
            isAttrInvalid: $scope.isAttrInvalid,
            duplicateAttribute: $scope.duplicateAttribute,
            isFirstInList: $scope.isFirstInList,
            isLastInList: $scope.isLastInList,
            moveAttribute: $scope.moveAttribute
        });
    });
    
    /*
     * attribute helpers
     */
    
    $scope.isAttrDirty = function(attr){
        if(attr.dirty || attr.isDirty) return true;
        if(attr.children) for(var i=0;i<attr.children.length;i++){
            if(attr.children[i].dirty || attr.children[i].isDirty) return true;
        }
        return false;
    };
    
    $scope.isAttrInvalid = function(attr){
        if(attr.invalid) return true;
        if(attr.children) for(var i=0;i<attr.children.length;i++){
            if(attr.children[i].invalid) return true;
        }
        return false;
    };
    
    $scope.duplicateAttribute = function(attr, index, attributes){
        var newAttr = angular.copy(attr);
        if(attr.children) for(var i=0;i<attr.children.length;i++) attr.children[i].dirty = attr.children[i].isDirty = true;
        else attr.dirty = attr.isDirty = true;
        (attributes || $scope.attributes).splice(index, 0, newAttr);
    };
    
    $scope.isFirstInList = function(a, index, attributes){
        attributes = attributes || $scope.attributes;
        return  !(attributes[index-1] && attributes[index-1].isList &&
                ((a.propName && attributes[index-1].propName === a.propName) || attributes[index-1].group === a.group));
    };
    
    $scope.isLastInList = function(a, index, attributes){
        attributes = attributes || $scope.attributes;
        return  !(attributes[index+1] && attributes[index+1].isList &&
                ((a.propName && attributes[index+1].propName === a.propName) || attributes[index+1].group === a.group));
    };
    
    $scope.moveAttribute = function(fromIndex, toIndex, a, attributes){
        attributes = attributes || $scope.attributes;
        if(!attributes) return;
        a.isDirty = a.dirty = true;
        attributes[toIndex].dirty = attributes[toIndex].isDirty = true;
        attributes.splice(fromIndex, 1);
        attributes.splice(toIndex,0,a);
    }
}])
.controller('EditableContainerCtrl', ['$scope', '$timeout', 'neEditable', 'neCms', 'neModals', function($scope, $timeout, editable, cms, modals){
    $scope.editable = editable;
    var defaultContainer = { ref:null, editors:{'default':{}}, children:[] };
    $scope.container = defaultContainer;
    $scope.$on('neEditable:focus', function(e, linkedSettings){
        // { ref, editors, children }
        $scope.container = linkedSettings;
        $scope.$digest();
    });
    $scope.getTemplateName = function(key){
        if(key==='default') return 'views/cms-editable-default.html';
        return ($scope.cmsContentEditors[key]||{}).template;
    };
    $scope.$on('neCms:pageChanged', function(){
        $scope.container = defaultContainer;
    });
    $scope.$on('neEditable:blur', function(){
        $scope.container = defaultContainer;
        modals.get('cms.editors').hide();
    });
}])
.directive('neAutoHeight', ['$timeout', function($timeout) {
    return {
        restrict: 'A',
        require: '?ngModel',
        link: function(scope, elm, attrs, ngModel) {
            if(elm[0].tagName!=='TEXTAREA') return; // this is only for text area
            
            // set nowrap
            elm[0].wrap = elm[0].wrap || 'off';
            
            var min_rows = attrs.rows || 2;
            elm.on('keydown', bindResize);
            
            scope.$on('$destroy', function(){
                elm.unbind('keydown', bindResize);
            });
            
            function bindResize(){ resize(); }
            
            function resize(value){
                var linecount = (value || elm[0].value || '').split('\n').length+1;
                elm[0].rows = linecount > min_rows ? linecount: min_rows;
            }
            
            ngModel.$viewChangeListeners.push(function(){
                $timeout(function(){ resize(ngModel.$viewValue); },0, false);
            });
            
            // resize on model first time value set
            scope.$watch(ngModel.$viewValue, function(){
                $timeout(function(){ resize(ngModel.$viewValue); },0, false);
            });
            
            // resize on neEditable:focus - when editors modal show
            scope.$on('neEditable:focus', function(){
                $timeout(function(){ resize(ngModel.$viewValue); },0, false);
            });
        }
    };
}])
.controller('AttributeImageCtrl', ['$scope', 'neCms', 'neModals', function($scope, cms, modals){
    
    $scope.setNaturalWidth = function(w){
        $scope.naturalWidth = w;
    };
    
    $scope.setNaturalHeight = function(h){
        $scope.naturalHeight = h;
    };
    
    $scope.getThumbSrc = function(){
        if($scope.attr.settings.valueAsUrl || !$scope.attr.settings.valueAsId){
            return $scope.attr.value || ('/cmsimages/generate/'+($scope.attr.settings.width||100)+'x'+($scope.attr.settings.height||100)+'.jpg')
        }
        else return ('/cmsimages/' + ($scope.attr.value || 'generate') + '/'+
                     ($scope.attr.settings.crop ? 'cx' : '')+
                     ($scope.attr.settings.width||100)+'x'+($scope.attr.settings.height||100)+'.jpg')
    };
    
    $scope.changeImageModal = function(){
        modals.create({
            id:'cms.attributes.changeImage',
            title:'Change Image',
            include:'views/cms-images-modal.html',
            removeOnClose: true,
            //wide:true,
            insertImage: function(url, imgId){
                if($scope.attr.settings.valueAsUrl || !$scope.attr.settings.valueAsId) $scope.attr.value = url;
                else $scope.attr.value = imgId;
                modals.get('cms.attributes.changeImage').hide();
                $scope.attr.dirty = true;
            },
            width: $scope.attr.settings.width,
            height: $scope.attr.settings.height,
            widthAuto: $scope.attr.settings.widthAuto,
            heightAuto: $scope.attr.settings.heightAuto,
            bg_color: $scope.attr.settings.bg_color,
            resize: {
                mode: $scope.attr.settings.crop ? { name:'crop', icon:'fa-crop' } : { name:'resize', icon:'fa-arrows-alt' },
                options:[{ name:'resize', icon:'fa-arrows-alt' }, { name:'crop', icon:'fa-crop' }]
            },
            url: '',
            imgId:null,
            generateUrl:function(image){
                if(!image) return;
                if(this.widthAuto) this.width = image.width;
                if(this.heightAuto) this.height = image.height;
                
                this.url = '/cmsimages/' +image.id;
                if(this.width && this.height) this.url += '/'+ (this.resize.mode.name==='crop' ? 'cx' : '') +this.width+ 'x' +this.height+(this.bg_color ? 'x'+this.bg_color : '')+ '.' +image.ext;
                else this.url += '.' +image.ext;
                this.imgId = image.id;
                return this.url;
            }
        });
    };
}])
.controller('CmsFormsCtrl', ['$scope', 'neCms', 'neObject', 'NeTree', 'NeGrid', 'neNotifications','neModals','neLocal',function($scope, cms, object, Tree, Grid, notify, modals, local){
    
    $scope.grid = new Grid({
        id: 'cms.forms',
        resource: cms.forms,
        autoLoad: true,
        defaultSort:{ createdDT:-1 },
        limit: 10,
        defaultQuery:{}
    }).load();
    
    $scope.fieldTypes;
    $scope.getFieldTypes = function(item){
        if(!$scope.fieldTypes) cms.forms.one('fieldtypes', function(data){
            $scope.fieldTypes = data;
        });
    };
    
    $scope.mailers = [];
    $scope.loadMailers = function(){
        cms.forms.one('mailerslist', function(data){
            $scope.mailers = data;
        });
    };
    
    $scope.deleteKey = function(key, obj){
        delete delete obj[ key ];
    };
    
    $scope.toggleEntryKey = function(propName, item){
        if(item.$entryKey===propName) item.$entryKey = undefined;
        else item.$entryKey = propName;
    };
    
    $scope.buildSchema = function(item){
        if(!item.$entrySchema) {
            item.entrySchema = {};
            return;
        }
        var schema = {}, $schema = item.$entrySchema;
        for(var prop in $schema){
            if(prop[0]!=='$'){
                schema[prop] = {};
                if($schema[prop].required) schema[prop].required = true;
                if($schema[prop].value) schema[prop].defaultValue = $schema[prop].value;
                if($schema[prop].sanitizer)
                    schema[prop][ $schema[prop].sanitizer.id ] = $schema[prop].$sanitizer.optsType!=='bool' ? ($schema[prop].sanitizer.value||$schema[prop].$sanitizer.defaultValue) : true;
                if($schema[prop].validator)
                    schema[prop][ $schema[prop].validator.id ] = $schema[prop].$validator.optsType!=='bool' ? ($schema[prop].validator.value||$schema[prop].$validator.defaultValue) : true;
            }
        }
        item.entryKey = item.$entryKey;
        item.entrySchema = schema;
    };
    
    $scope.parseSchema = function(item){
        if(!$scope.fieldTypes) return;
        if(item.$entrySchema) return item.$entrySchema;
        item.$entryKey = item.entryKey;
        
        var $schema = {}, schema = item.entrySchema;
        for(var prop in schema){
            $schema[prop] = {};
            if(schema[prop].required) $schema[prop].required = true;
            if(schema[prop].defaultValue) $schema[prop].value = schema[prop].defaultValue;
            
            for(var id in schema[prop]){
                if($scope.fieldTypes.sanitizers[id]) {
                    $schema[prop].$sanitizer = $scope.fieldTypes.sanitizers[id];
                    $schema[prop].sanitizer = {
                        id: id,
                        value: schema[prop][id]
                    }
                }
                if($scope.fieldTypes.validators[id]) {
                    $schema[prop].$validator = $scope.fieldTypes.validators[id];
                    $schema[prop].validator = {
                        id: id,
                        value: schema[prop][id]
                    };
                }
            }
        }
        item.$entrySchema = $schema;
        return item.$entrySchema;
    };
    
    
    $scope.createModal = function(parent){
        modals.create({
            id:'cms.forms.create',
            title:'Create New Form',
            include:'views/cms-forms-create.html',
            create: function(item){
                $scope.grid.createItem(item, function(){
                    modals.get('cms.forms.create').hide();
                });
            },
            item: {
                id:''
            }
        });
    };
    
    $scope.removeModal = function(item){
        modals.create({
            id:'cms.forms.remove',
            title:'Remove Form',
            text:'This will remove form include all form entries. Are you sure ?',
            buttons:[
                { text:'Cancel', css:'btn btn-default', disabled:false, click: function(){ modals.get('cms.forms.remove').hide(); } },
                { text:'Delete', css:'btn btn-danger', disabled:false ,click: function(){
                        $scope.grid.removeItem(item, function(){
                            modals.get('cms.forms.remove').hide();
                        });
                    }
                }
            ]
        });
    };
    
    $scope.createEntriesGrid = function(formItem){
        if(formItem.$entGrid) return formItem.$entGrid;
        formItem.$entGrid = new Grid({
            id: 'cms.forms.entries',
            resource: cms.form_entries,
            autoLoad: true,
            multiselect: true,
            defaultSort:{ createdDT:-1 },
            limit: 10,
            defaultQuery:{ formId:formItem.id }
        }).load();
        return formItem.$entGrid;
    }
    
    $scope.getEmailDocTree = function(email){
        if(email.$tree) return email.$tree;
        email.$tree = new Tree({
            id: 'cms.forms.emaildocuments_'+new Date(),
            resource: cms.documents,
            ancestorsReferenceKey:'ancestors',
            autoLoad:true,
            defaultSort:{},
            limit:10,
            defaultQuery:{},
            itemTemplate: 'views/cms-images-document-item.html',
            onFocus: function(item){
                email.documentUrl = item.url;
            }
        }).load();
        return email.$tree;
    }
    
    $scope.entryLogModal = function(log){
        modals.create({
            id: 'cms.forms.entrylog',
            title: 'Entry Log Details',
            html: '<strong>' +local.translate('Created')+ ' </strong> '+log.createdDT +
                  '<br><strong>' +local.translate('Event')+ ' </strong> '+log.event+
                  '<br><strong>' +local.translate('Status')+ ' </strong> '+log.status+
                  (log.error ? '<br><strong>' +local.translate('Error')+ ' </strong> '+log.error : ''),
            buttons:[
                { text:'Close', css:'btn btn-default', disabled:false ,click: function(){
                        modals.get('cms.forms.entrylog').hide();
                    }
                }
            ]
        });
    };
}])
.directive('neFormFieldEditor', function() {
    return {
        restrict: 'EA',
        //replace: true,
        scope: { model:'=', placeholder:'=', type:'=' },
        template: '<div ng-if="type" ng-include="\'views/cms-forms-editor-\'+type+\'.html\'">',
        link: function(scope, elm, attr){
            
        }
    };
});

