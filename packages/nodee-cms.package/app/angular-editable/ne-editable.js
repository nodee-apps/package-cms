angular.module('neEditable',['neObject'])
.provider('neEditable', [function(){
    
    // config vars
    var _defaultSettings = {};
    var _allowedEditors = [];
    var _abListenerFncs = []; // functions to run after editable.bind
    var _bindListenerFncs = []; // functions to run on editable.bind
    var _unbindListenerFncs = []; // functions to run on editable.unbind, or editable.getCleanHTML()

    //config methods
    this.setDefaultSettings = setDefaultSettings; // setDefaultSettings({'A,P':{ test:{}, richtext:{}s});
    this.setAllowedEditors = setAllowedEditors; // setAllowedEditors(['text','richtext','block','attr','img']);
    this.registerEditor = registerEditor; // registerEditor('custom editor name');
    this.addAfterBindListener = addAfterBindListener; // onInitListener(function(elm, elmEditSettings){ elm.on('drop', ... );  });
    this.addBindListener = addBindListener; // addBindListener(function(elm, elmEditSettings){  return elmToBind;  });
    this.addUnbindListener = addUnbindListener; // addUnbindListener(function(elm, elmEditSettings){  return elmToBind;  });
    
    function setDefaultSettings(conf){
        _defaultSettings = conf;
    }
    function setAllowedEditors(editorNames){
        _allowedEditors = editorNames;
    }
    function registerEditor(editorName){
        _allowedEditors.push(editorName);
    }
    function addAfterBindListener(listenerFnc){
        _abListenerFncs.push(listenerFnc);
    }
    function addBindListener(listenerFnc){
        _bindListenerFncs.push(listenerFnc);
    }
    function addUnbindListener(listenerFnc){
        _unbindListenerFncs.push(listenerFnc);
    }
    
    // default config
    setDefaultSettings({
        //'P,SPAN,LI,DIV':{ text:{} },
        //'A':{ attrs:{href:{}} },
        //'IMG':{ image:{ }}
        // 'link':'ancestor / descendant / parent / child' - set linked element 
    });
    
    // if allowed editors not set, any will be allowed
    //setAllowedEditors(['text','richtext','container','block','attrs','image']);
    
    // provider getter
    this.$get = ['$rootScope', 'neObject', '$timeout', function($rootScope, object, $timeout){ return new editable($rootScope, object, $timeout); }];
    
    // service definition
    function editable($rootScope, object, $timeout){
        
        // private variables
        var _target;
        var _templates;
        var _linkedSettings;
        var _groupCount = 0;
        var _parentElm;
        var _changesCount = 0; // dirty tracking changes
        
        this.registerEditor = registerEditor; // registerEditor('custom editor name');
        this.addUnbindListener = addUnbindListener; // addUnbindListener(function(elm, elmEditSettings){  return elmToBind;  });
        this.addBindListener = addBindListener; // addBindListener(function(elm, elmEditSettings){  return elmToBind;  });
        this.addAfterBindListener = addAfterBindListener; // addAfterBindListener(function(parentElm){ elm.on('drop', ... );  });
        this.bind = bind; // bind(parentElm)
        this.getTemplates = getTemplates; // getTemplates([ids array]);
        this.getElm = getElm; //getElm([element]) default element=target
        this.updateElm = updateElm; //updateElm([elm]; {attr; style; html});
        this.removeElm = removeElm; //removeElm()
        this.moveElm = moveElm; // moveElm([elm], 'up' / 'down');
        this.createElm = createElm; // createElm(elm to clone / html text; [afterElm])
        //this.showMenu();
        //this.showContextMenu();
        this.getEditableSettings = getEditableSettings; // getEditableSettings(elm)
        this.getLinkedSettings = getLinkedSettings; // getLinkedSettings()
        this.setTargetElm = setTargetElm; // setTargetElm(elm)
        this.getTargetElm = getTargetElm; // getTargetElm()
        this.markDirty = markDirty; // markDirty()
        this.unmarkDirty = unmarkDirty; // unmarkDirty()
        this.markDirtyButton = markDirtyButton; // markDirtyButton(btnId)
        this.unmarkDirtyButton = unmarkDirtyButton; // unmarkDirtyButton(btnId)
        this.markSelected = markSelected; // markSelected([elm])
        this.unmarkSelected = unmarkSelected; // unmarkSelected([elm])
        this.focusParent = focusParent; // focusParent(elm)
        this.clearAllDirtyMarks = clearAllDirtyMarks; // clearAllDirtyMarks()
        this.getCleanHTML = getCleanHTML; // getCleanHTML()
        this.mappings = []; // editors mappings
        this.isDirty = function(){ return _changesCount > 0; }; // editable dirty tracking
        this.changesCount = function(){ return _changesCount; };
        this.markNotDirty = function(){ _changesCount = 0; };
        this.createWidget = createWidget;
        
        // editable methods
        function bind(parentElm){
            parentElm = angular.element(parentElm);
            
            // store reference on parent element only if it is html document
            if(parentElm[0].nodeName==='#document') _parentElm = parentElm.find('html');
            
            generateEditSettings(parentElm, this.mappings);
            registerEditableGroups(parentElm);
            bindContainers(parentElm, this.mappings);
            
            // prevent dragging and clicking links
            parentElm.find('a').on('click', function(e){ e.preventDefault(); });
            
            if(parentElm[0].nodeName==='#document') {
                var editableStyle = '<style id="ne-editable-style">[ne-editable-settings]:not([ne-editable-settings*="_linkedGroup"]):not([ne-editable-settings*="container"]){ ' +
                //'-webkit-box-shadow: 1px 1px 1px 1px blue;' +
                //'-moz-box-shadow:    1px 1px 1px 1px blue;' +
                //'box-shadow:         1px 1px 1px 1px blue;' +
                'outline:1px dashed #ccc;' +
                'cursor:pointer !important; } ' +
                '[ne-editable-settings]:not([ne-editable-settings*="_linkedGroup"]):not([ne-editable-settings*="container"]):hover, ' +
                '[ne-editable-settings*="_selected"]:not([ne-editable-settings*="container"]) { ' +
                //'-webkit-box-shadow: 0px 0px 8px green !important;' +
                //'-moz-box-shadow:    0px 0px 8px green !important;' +
                //'box-shadow:         0px 0px 8px green !important;' +
                'outline:2px solid #73A500 !important;' +
                'opacity:1;' +
                '} [ne-editable-settings*="_dirty"] { ' +
                //'-webkit-box-shadow: 0px 0px 8px red !important;' +
                //'-moz-box-shadow:    0px 0px 8px red !important;' +
                //'box-shadow:         0px 0px 8px red !important; }' +
                'outline:2px solid #EC971F !important; }' +
                '[ne-editable-button-wrapper]{position:relative;z-index:9999;text-align:center;width:100%;}' +
                '[ne-editable-buttons]{position:absolute;z-index:9999;top:-15px;left:5px;}' +
                '[ne-editable-buttons] > [ne-editable-button]:first-child:not(:last-child){border-top-right-radius:0;border-bottom-right-radius:0;}' +
                '[ne-editable-buttons] > [ne-editable-button]:last-child:not(:first-child){border-bottom-left-radius:0;border-top-left-radius:0;}' +
                '[ne-editable-buttons] > [ne-editable-button]:not(:first-child):not(:last-child){border-radius:0;}' +
                '[ne-editable-button]{' +
                    'margin-left:-1px;' +
                    '-webkit-border-radius:3px;' +
                    '-moz-border-radius:3px;' +
                    'border-radius:3px;'+
                    'background-color:#fff;'+
                    'border:1px solid #ccc;'+
                    'opacity:0.7;'+
                    'background-size:11px 11px;'+
                    'display:inline-block;'+
                    'height:25px;width:25px;z-index:9999;cursor:pointer;}' +
                '[ne-editable-button]:hover{border-color:#ADADAD;background-color:#E6E6E6;}'+ //'outline:2px solid #73A500;}' +
                '[ne-editable-button-wrapper][dirty] > editable-button {background-color:#EC971F}' +
                // button icons
                '[ne-editable-button-wrench]{background-repeat:no-repeat;background-position:center center;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAeQAAAHkBOLWIEgAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADPSURBVDiNpdExSkNBFIXhb0BEBJcQxJWIS4ikSJMmO7DIAixDwB2YOhuwsHABtimSNqRJr6XCtZkX4uO9l4wO3GK45z/3zB0R4VhhhHd8YovpvncC/IQ4qB1GJxngrgbPcPVLUzj9oq450316bY2U0iXGxwxWtftLSmmCm5zuoyv+APd589FQ37jtgr+wxrDFZNK4xAO4Eq5zkkcs8IDrxl9ogCPfB61P/Q+8N/grnFn9LH7DsgSuDDYZesZrCVwZzEtj1w3O8/QN+iVwRPgBDWLLngIBDT0AAAAASUVORK5CYII02c5a3fd80dc3383cb1dcc9d49b92a3d");}'+
                '[ne-editable-button-arrow-up]{background-repeat:no-repeat;background-position:center center;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAfwAAAH8BuLbMiQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAACySURBVDiNtZJRCoMwEERfQqE9mEcoRXoNr+EZFBH60Xu19Aj60+lPChtdRQtdWMhOZh5kSZCEVyGECFzTeJP0do2SZg1EoAGUugGi690QXoVsDS9C9oRdyN7wDPJLOIMA1M5lD4xmHpM29dUAz4nYJfJgtCFp3cT7AKiM0Jq3ZQCzq9bo1XeJBVBm23UABlIChSTCylcegGMaR0knzxfd9I76K+C1cM7qsAI4A5d0vi+ZPhwl4IqxKv7yAAAAAElFTkSuQmCC2cb089aeaf3749b5cf184cde9492adb5");}' +
                '[ne-editable-button-arrow-down]{background-repeat:no-repeat;background-position:center center;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAA3NCSVQICAjb4U/gAAAACXBIWXMAAAB/AAAAfwG4tsyJAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAEJQTFRF////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhihLswAAABV0Uk5TAAEDBDc5TGlskpaZpaanqKmq3uT42uynWQAAAGhJREFUGFeNzUkWgCAQQ8HQzrOguf9VJQJP3ZlN82sDcK+epjq98gIZPnCS539oWlfAtQ3QkaNL4Eayw0GJQM0DAyUCNQfYrFs2G2DL04vpG1tLr3dH2VJvuYFqV+9V6Sie9K+O0ve5L3YoCRWcjg4jAAAAAElFTkSuQmCCa5991b5c70e6917873a59c08c94659ad");}'+
                '[ne-editable-button-trash]{background-repeat:no-repeat;background-position:center center;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAgQAAAIEBHRF40wAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADUSURBVDiN3dIxSkNREAXQcyXFF7R1C+7DJk3wt9mC4ALcioWQrEHrbEBcgI1CViBYBNI8mxd5fj+GkM6BgfvuuzPcGUYpRZsIHrBFqbmtXIb61KLvSDLDI27wUelz3OO6lPLU6idJLnDVcLd4b4rhE2+4S3LW8CvoG6uHZt/OXjAfzjiyoznK7n3iyPjVIEmfZFPxIsmi4k2SfqifjDQ9RVdx1/Bd/fvbwaHxDxqMLfEVy4pXDb+sf5c/1MceUuvgBbMk+1zP8DzmYIq1/fe/xnRX9wXvLqjTy1CceQAAAABJRU5ErkJggg250f920e72386b0d62f2ee55fd2c838e");}'+
                '[ne-editable-button-plus]{background-repeat:no-repeat;background-position:center center;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAA3NCSVQICAjb4U/gAAAACXBIWXMAAACNAAAAjQHGZvekAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAABVQTFRF////AAAAAAAAAAAAAAAAAAAAAAAAPYbscQAAAAZ0Uk5TAAcvMFfRBJKoqAAAADpJREFUCFtjYGBgDEsVYAABprQ0BTCDOS3NACtDyNgkLc3ZWJEhLA0MUhnSoADBgEvBFeMxEMlSiDMAPO8ZxZEBQIwAAAAASUVORK5CYII01c0683bb62348b87fcd782b30ef954f");}'+
                '</style>';
                
                // only append if parent element has body
                angular.element(parentElm[0].body).append(editableStyle);
                
                // findTemplates(parentElm);
            }
            
            // fire afterBindListeners
            for(var l in _abListenerFncs){
                _abListenerFncs[l](parentElm);
            }
        }
        
        function findTemplates(parentElm) {
            _templates = [];
            parentElm.find('script[type="text/ne-editable-template"]').each(function(){
                var template = angular.element(this);
                if(template.attr('id')) {
                    _templates.push({
                        id:template.attr('id'),
                        name:(template.attr('name') || template.attr('id')),
                        types:(template.attr('for') || template.attr('template-types') ||template.attr('template-type') || '').split(',') || [],
                        html:template.html()
                    });
                }
            });
        }
        
        function getTemplates(ids, types){
            if(arguments.length===0) return _templates;
            if(!ids && !types) return [];
            
            if(angular.isString(ids)) ids = [ids];
            if(angular.isString(types)) types = [types];
            
            var foundTemplates = [];
            var index = -1;
            for(var i=0;i<_templates.length;i++) {
                if(types){
                    index = -1;
                    for(var t=0;t<_templates[i].types.length;t++){
                        if(types.indexOf(_templates[i].types[t])!==-1) index = types.indexOf(_templates[i].types[t]);
                    }
                }
                else index = ids.indexOf(_templates[i].id);
                
                if(index!==-1) foundTemplates.push(_templates[i]);
            }
            return foundTemplates;
        }
        
        function parseJson(json, elm) {
            json = json || '{}';
            json = json.replace(/'/g,'"');
            try {
                return JSON.parse(json);
            }
            catch(error) {
                console.log(error.toString());
                if(elm) console.log(elm[0]);
                console.log(json);
                return undefined;
            }
        }
        
        function generateEditSettings(parentElm, mappings){
            mappings = mappings || [];
            var widgetsCount = {};
            for(var s=0;s<mappings.length;s++){
                var tmpId = mappings[s].id;
                var editorsMapping = mappings[s].mapping.editors || {};
                var hasAttributes = (mappings[s].mapping.attributes || []).length > 0;
                
                // bind all widgets
                if(mappings[s].isWidget) {
                    widgetsCount[tmpId] = widgetsCount[tmpId] || 0;
                    parentElm
                    .find('[ne-template-id="' +tmpId+ '"]')
                    .add( parentElm.is('[ne-template-id="' +tmpId+ '"]') ? parentElm : null )
                    .each(function(){
                        if(this.nodeName==='#text') return; // ignore text nodes
                        bindWidget(tmpId, widgetsCount[tmpId], angular.element(this), hasAttributes);
                        widgetsCount[tmpId]++;
                    });
                }
                
                // copy [ne-editable] attribute to [ne-editable-settings] in all editable elements
                parentElm
                .find('[ne-template-id="' +tmpId+ '"] *')
                .add( parentElm.is('[ne-template-id="' +tmpId+ '"]') ? parentElm : null )
                .filter('[ne-editable]')
                .each(function(){
                    var elm = angular.element(this);
                    if(elm.closest('[ne-template-id]').attr('ne-template-id') !== tmpId) return; // skip editables not children of this template
                    
                    elm.attr('ne-editable-settings', JSON.stringify(parseJson(elm.attr('ne-editable'),elm)));
                });
                
                // inherit element editable-settings from global editable settings
                for(var selector in editorsMapping) {
                    parentElm
                    .find(parentElm[0].nodeName==='#document' ? '[ne-template-id="' +tmpId+ '"],[ne-template-id="' +tmpId+ '"] *' : '*')
                    .add( parentElm.is('[ne-template-id="' +tmpId+ '"]') ? parentElm : null )
                    .filter(selector)
                    .each(function(){
                        var editElm = angular.element(this);
                        if(editElm.closest('[ne-template-id]').attr('ne-template-id') !== tmpId) return; // skip editables not children of this template
                        
                        var editSettings = object.extend(true, parseJson(editElm.attr('ne-editable-settings')), editorsMapping[selector]);
                        if(Object.keys(editSettings).length===0) object.extend(true, editSettings, getDefaultSettings(editElm));
                        
                        if(editSettings.group) {
                            _groupCount++;
                            editSettings._groupId = 'g' + _groupCount;
                        }
                        
                        if(editSettings.disabled) editElm.removeAttr('ne-editable-settings');
                        else editElm.attr('ne-editable-settings', JSON.stringify(editSettings));
                    });
                }
            }
        }
        
        function bindWidget(tmpId, num, elm, hasAttributes){
            elm = angular.element(elm);
            var widgetId = elm.attr('ne-widget-id'),
                container = elm.closest('[ne-container-id],[ne-container]'),
                containerId = container.attr('ne-container-id') || container.attr('ne-container') || '',
                prev = elm.prev();
            
            // in case this is part of already binded widget, just insert it after and skip bindings
            if(prev.attr('ne-widget-id') === widgetId && prev.attr('ne-template-id') === tmpId) return prev.after(elm);
            
            // skip if widget missing id and is in container, this is not allowed
            if(containerId && !widgetId) return;
            
            var btn = angular.element('<div ne-editable-button-wrapper="'+tmpId+'_'+(widgetId || num)+'">'+
                                      '<div ne-editable-buttons>'+
                                      (hasAttributes ? '<div ne-editable-button ne-editable-button-wrench></div>' : '')+
                                      (containerId ? '<div ne-editable-button ne-editable-button-arrow-up></div>'+
                                                     '<div ne-editable-button ne-editable-button-arrow-down></div>'+
                                                     '<div ne-editable-button ne-editable-button-trash></div>' : '') +
                                      '</div></div>');
            
            if((elm.css('display')||'').indexOf('inline')>-1) btn.css('display','inline-block');
            // TODO: move if elm has margin, or absolute position
            
            btn.find('[ne-editable-button-wrench]').on('click', function(){
                $rootScope.$broadcast('neEditable:attributes', containerId, widgetId, tmpId, num);
            });
            if(containerId){
                btn.find('[ne-editable-button-arrow-up]').on('click', function(){
                    // move up
                    var elm = angular.element(this),
                        wrapper = elm.closest('[ne-editable-button-wrapper]'),
                        widget = wrapper.nextAll('[ne-widget-id="'+widgetId+'"]'),
                        prevWidgetId = wrapper.prevAll('[ne-widget-id]:not([ne-widget-id="'+widgetId+'"])').first().attr('ne-widget-id'),
                        prevWidgetMenu = wrapper.siblings('[ne-widget-id="'+prevWidgetId+'"]').first().prev('[ne-editable-button-wrapper]');
                    
                    if(prevWidgetMenu.length){
                        prevWidgetMenu.before(wrapper);
                        prevWidgetMenu.before(widget);
                        _changesCount++;
                        $rootScope.$apply();
                    }
                }); 
                btn.find('[ne-editable-button-arrow-down]').on('click', function(){
                    // move down
                    var elm = angular.element(this),
                        wrapper = elm.closest('[ne-editable-button-wrapper]'),
                        widget = wrapper.nextAll('[ne-widget-id="'+widgetId+'"]'),
                        nextWidgetId = wrapper.nextAll('[ne-widget-id]:not([ne-widget-id="'+widgetId+'"])').first().attr('ne-widget-id'),
                        nextWidget = wrapper.siblings('[ne-widget-id="'+nextWidgetId+'"]').last();
                    
                    if(nextWidget.length){
                        nextWidget.after(widget);
                        nextWidget.after(wrapper);
                        _changesCount++;
                        $rootScope.$apply();
                    }
                });
                btn.find('[ne-editable-button-trash]').on('click', function(){
                    // remove widget, and editable-buttons
                    var elm = angular.element(this),
                        wrapper = elm.closest('[ne-editable-button-wrapper]');
                    
                    wrapper.nextAll('[ne-widget-id="'+widgetId+'"]').remove();
                    wrapper.remove();
                    _changesCount++;
                    $rootScope.$apply();
                });
            }
            elm.first().before(btn);
        }
        
        function bindContainers(parentElm, mappings){
            var containerIds = {};
            
            parentElm.find('[ne-container],[ne-container-id]').each(function(){
                var cnt = angular.element(this),
                    cntId = cnt.attr('ne-container') || cnt.attr('ne-container-id'),
                    allowedWidgets = (cnt.attr('ne-container-templates') || cnt.attr('ne-container-widgets') || '').replace(/\s/g,'').split(',');
                
                // clean all empty ids
                for(var i=0;i<allowedWidgets.length;i++){
                    if(!allowedWidgets[i]){
                        allowedWidgets.splice(i, 1);
                        i--;
                    }
                }
                
                if(cntId && !containerIds[ cntId ]){ // ignore containers without id or duplicite id
                    containerIds[ cntId ] = true;
                    
                    var btn = angular.element('<div ne-editable-button-wrapper="container_'+cntId+'">'+
                                      '<div style="display:inline-block;" ne-editable-button ne-editable-button-plus></div>'+
                                      '</div>');
                    
                    if((cnt.css('display')||'').indexOf('inline')>-1) btn.css('display','inline-block');
                    
                    btn.find('[ne-editable-button-plus]').on('click', function(){
                        $rootScope.$broadcast('neEditable:container', cntId, allowedWidgets);
                    });
                    
                    // append plus button to the end of container
                    cnt.append(btn);
                }
            });
        }
        
        function createWidget(containerId, template, mapping, html){
            var elm = angular.element(html);
            if(!elm[0] || elm[0].nodeName==='#text') return; // ignore text nodes
            
            var widget = elm.attr('ne-template-id',template),
                container = _parentElm.find('[ne-container="'+containerId+'"],[ne-container-id="'+containerId+'"]').first(),
                widgetId = mapping.baseProp;
            
            var widgets = {};
            container.find('[ne-template-id="'+template+'"]').each(function(){
                var wId = angular.element(this).attr('ne-widget-id');
                widgets[wId] = true;
            });
            if(widgets[widgetId]) for(var i=1;i<1000;i++){
                widgetId = mapping.baseProp + '_' + i;
                if(!widgets[widgetId]) break;
            }
            
            widget.attr('ne-widget-id', widgetId);
            container.find('[ne-editable-button-wrapper="container_'+containerId+'"]').before(widget);
            
            var mappingExists = false;
            for(var i=0;i<this.mappings.length;i++){
                if(this.mappings[i].id === template) {
                    mappingExists = true;
                    break;
                }
            }
            
            if(!mappingExists) {
                this.mappings.push({ id:template, mapping:mapping, isWidget:true });
            }
            
            _changesCount++;
            this.bind(widget);
        }
        
        function markDirtyButton(id){
            _parentElm.find('[ne-editable-button-wrapper="'+id+'"]').attr('dirty','true');
            _changesCount++;
        }
        
        function unmarkDirtyButton(id){
            _parentElm.find('[ne-editable-button-wrapper="'+id+'"]').removeAttr('dirty');
        }
        
        function registerEditableGroups(parentElm){
            // regiter group & editable descendants until next group
            parentElm.find('[ne-editable-settings]').andSelf().filter('[ne-editable-settings]').each(function(){
                var elm = angular.element(this);
                var editSettings = getEditableSettings(elm);
                if(editSettings._groupId){
                    linkDescendants(elm, editSettings._groupId);
                    elm.attr('ne-editable-settings', JSON.stringify(editSettings));
                    addEditElmListeners(elm, editSettings);
                }
                else if(!editSettings._linkedGroup) { // for elements outide group
                    addEditElmListeners(elm, editSettings);
                }
            });
            
            function linkDescendants(groupElm, groupId){
                groupElm.find('[ne-editable-settings]').each(function(){
                    var elm = angular.element(this);
                    var editSettings = getEditableSettings(elm);
                    // link only non-group descendants
                    if(!editSettings._groupId) {
                        editSettings._linkedGroup = groupId;
                        elm.attr('ne-editable-settings', JSON.stringify(editSettings));
                    }
                });
            }
        }
        
        function addEditElmListeners(elm, editSettings){
            var elmToBind = elm;
            
            // fire bindListeners
            for(var l in _bindListenerFncs){
                elmToBind = _bindListenerFncs[l](elm, editSettings) || elmToBind;
            }
            
            // default event onclick show editors
            elmToBind.on('click', function(e){
                e.preventDefault();
                e.stopPropagation();
                setTargetElm(elm);
            });
        }
        
        function getDefaultSettings(elm){
            var defSet = {};
            var nodeName = elm[0].nodeName;
            for(var key in _defaultSettings) {
                var names = key.split(',');
                for(var index in names){
                    if(names[index]===nodeName) {
                        object.extend(true, defSet, _defaultSettings[key]);
                        break;
                    }
                }
            }
            return defSet;
        }
        
        function setTargetElm(elm){
            unmarkSelected();
            _target = elm;
            setLinkedSettings();
            markSelected(elm);
            $rootScope.$broadcast('neEditable:focus', getLinkedSettings());
        }
        function getTargetElm(sel,contains){
            if(sel==='parent') return _target.parent('[ne-editable-settings]');
            else if(sel==='child') return _target.children('[ne-editable-settings]').first();
            else if(sel==='ancestor') return _target.parents('[ne-editable-settings*=' + contains + ']').first();
            else if(sel==='descendant') console.log('descendant editable opts not implemented'); //return _target.find('[ne-editable-settings]').first();
            
            return _target;
        }
        
        // get editable-settings attribute - before linking
        function getEditableSettings(elm){
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            if(!elm) return;
            
            var editAttr = elm.attr('ne-editable-settings');
            if(editAttr===undefined) return null; // this is not editable or properly binded element
            var editSettings = parseJson(editAttr, elm);
            if(!editSettings) return null; // this is not editable or properly binded element
            return editSettings;
        }
        
        // set target editable-settings after linking
        function setLinkedSettings(){
            var target = getTargetElm();
            var editSettings = getEditableSettings();
            var groupId = editSettings._groupId;
            var linkedSettings = { ref:target, editors:allowedEditorsOnly(editSettings), children:[], root:groupId };
            
            function getChildTree(parent, selector, childrenArray){
                parent.children().each(function(){
                    var elm = angular.element(this);
                    if(elm.is(selector)){
                        var item = { ref:elm, editors:allowedEditorsOnly(getEditableSettings(elm)), children:[], root:groupId };
                        getChildTree(elm, selector, item.children);
                        childrenArray.push(item);
                    }
                    else {
                        getChildTree(elm, selector, childrenArray);
                    }
                });
            }
            
            function allowedEditorsOnly(editSettings){
                if(!_allowedEditors.length) return editSettings;
                
                var filtered = {};
                for(var key in editSettings){
                    if(_allowedEditors.indexOf(key)!==-1) filtered[key] = editSettings[key];
                }
                return filtered;
            }
            
            if(groupId) getChildTree(target, '[ne-editable-settings*="_linkedGroup\\":\\"' + groupId + '\\""]', linkedSettings.children);
            _linkedSettings = linkedSettings;
            
        }
        
        // get target editable-settings after linking
        function getLinkedSettings(){
            return _linkedSettings;
        }
        
        function getElm(elm){
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            //var editSettings = getEditableSettings();
            //var linkedSettings = getLinkedSettings();
            
            var html = elm.html().replace(/(\r\n|\r|\n)\s*$/, ''); // replace line endings and white spaces
            var targetJson = { attr:{}, style:null, html:html, _ref:elm };
            
            // get all target attributes
            for(var i=0;i<elm[0].attributes.length;i++) {
                var attr = elm[0].attributes[i];
                if(attr.name==='style') {
                    targetJson.style = styleToObject(attr.value);
                }
                else {
                    targetJson.attr[attr.name] = angular.copy(attr.value);
                }
            }
            
            function styleToObject(style){
                var styles = style.split(';');
                var styleObj = {};
                for(var s in styles) {
                    if(styles[s]!=='' && styles[s]!==' ') styleObj[styles[s].split(':')[0]] = styles[s].split(':')[1];
                }
                return styleObj;
            }
            
            targetJson.attrs = targetJson.attr;
            return targetJson;
        }
        
        function updateElm(){ //[elm], values
            var elm, values;
            if(arguments.length === 0) return;
            if(arguments.length === 1) {
                elm = getTargetElm();
                values = arguments[0];
            }
            if(arguments.length > 1) {
                elm = arguments[0];
                values = arguments[1];
            }
            
            elm = elm && elm.ref ? elm.ref : elm;
            var editSettings = getEditableSettings(elm);
            var isDirty = false;
            
            if(values.html) {
                elm.html(values.html);
                isDirty = true;
            }
            if(values.attr) {
                for(var key in values.attr) {
                    elm.attr(key, values.attr[key]);
                    isDirty = true;
                }
            }
            if(values.attrs) {
                for(var key in values.attrs) {
                    elm.attr(key, values.attrs[key]);
                    isDirty = true;
                }
            }
            if(values.style) {
                elm.attr('style', objectToStyle(values.style));
                isDirty = true;
            }
            
            function objectToStyle(styleObj){
                var style = '';
                for(var key in styleObj) {
                    style += key + ':' + styleObj[key] + ';';
                }
                return style;
            }
            
            if(isDirty) markDirty();
            $rootScope.$broadcast('neEditable:updateElm', elm);
        }
        
        function removeElm(elm, groupId){
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            
            var parent = getParent(elm);
            if(elm.parent().children().length===1){
                // this is last element - can't be removed
                return;
            }
            else elm.remove();
            
            $rootScope.$broadcast('neEditable:removeElm');
            if(groupId){
                $timeout(function(){
                    if(!parent) $rootScope.$broadcast('neEditable:blur'); // parent group not found, removed elm was group
                    else setTargetElm(parent);
                }, 0, false);
            }
            else {
                $rootScope.$broadcast('neEditable:blur'); // removing element outside of group
            }
            
            _changesCount++; // - parent element or document
        }
        
        function moveElm(){ // [elm], direction, groupId
            var elm, direction, groupId;
            if(arguments.length === 0) return;
            if(arguments.length === 1) {
                elm = getTargetElm();
                direction = arguments[0];
                groupId = null;
            }
            if(arguments.length > 1) {
                elm = arguments[0];
                direction = arguments[1];
                groupId = arguments[2];
            }
            elm = elm && elm.ref ? elm.ref : elm;
            
            if(direction==='up') {
                elm.prev().before(elm);
                markDirty();
            }
            else if(direction==='down') {
                if(!elm.next().is('[ne-editable-placeholder]')){
                    elm.next().after(elm);
                    markDirty();
                }
            }
            else console.log('unknown direction, use "up" or "down"');
            
            $rootScope.$broadcast('neEditable:moveElm', elm);
            if(groupId) $timeout(focusParent, 0 ,false);
        }
        
        function createElm(elm, afterElm, groupId){ //(elm to clone / html text, afterElm, groupId);
            if(angular.isString(elm)) elm = angular.element(elm);
            else {
                elm = elm && elm.ref ? elm.ref : elm;
                elm = elm.clone();
            }
            var isPlaceholder = groupId===true;
            
            afterElm = afterElm || getTargetElm();
            afterElm = afterElm && afterElm.ref ? afterElm.ref : afterElm;
            
            if(isPlaceholder) {
                afterElm = afterElm.children('[ne-editable-placeholder]').first();
                afterElm.before(elm);
            }
            else afterElm.after(elm);
            
            bind(elm);
            unmarkSelected(elm);
            markDirty(elm);
            
            $rootScope.$broadcast('neEditable:createElm', elm);
            if(groupId) $timeout(focusParent, 0, false);
        }
        
        function markSelected(elm) {
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            var editSettings = getEditableSettings(elm);
            if(editSettings) {
                editSettings._selected = true;
                elm.attr('ne-editable-settings', JSON.stringify(editSettings));
            }
        }
        
        function unmarkSelected(elm) {
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            var editSettings = getEditableSettings(elm);
            if(editSettings) {
                delete editSettings._selected;
                elm.attr('ne-editable-settings', JSON.stringify(editSettings));
            }
        }
        
        function markDirty(elm) {
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            var editSettings = getEditableSettings(elm);
            if(editSettings) {
                editSettings._dirty = true;
                elm.attr('ne-editable-settings', JSON.stringify(editSettings));
            }
            _changesCount++;
        }
        
        function unmarkDirty(elm) {
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            var editSettings = getEditableSettings(elm);
            if(editSettings) {
                delete editSettings._dirty;
                elm.attr('ne-editable-settings', JSON.stringify(editSettings));
            }
        }
        
        function clearAllDirtyMarks() {
            _parentElm.find('[ne-editable-settings*="_dirty"]').each(function(){
                var elm = angular.element(this);
                unmarkDirty(elm);
            });
            _parentElm.find('[ne-editable-button][dirty]').removeAttr('dirty');
            _changesCount = 0;
        }
        
        function getParent(elm){
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            var editSettings = getEditableSettings(elm);
            
            if(editSettings._linkedGroup) {
                var parent = elm.parents('[ne-editable-settings*="_groupId\\"\\:\\"' + editSettings._linkedGroup + '"]').first();
                if(parent.length > 0) return parent; // parent found
                else return null; // parent not found
            }
            else return null; // parent not found
        }
        
        function focusParent(elm){
            elm = elm || getTargetElm();
            elm = elm && elm.ref ? elm.ref : elm;
            var editSettings = getEditableSettings(elm);
            
            if(editSettings._linkedGroup) {
                var parent = elm.parents('[ne-editable-settings*="_groupId\\"\\:\\"' + editSettings._linkedGroup + '"]').first();
                if(parent.length > 0) {
                    setTargetElm(parent);
                    return true; // parent found
                }
                else return false; // parent not found
            }
            else return false; // parent not found
        }
        
        function getCleanHTML(){
            var contentElm = angular.element('<div></div>').append(_parentElm.clone());
            
            if(_unbindListenerFncs.length>0){
                contentElm.find('[ne-editable-settings]').each(function(){
                    var elm = angular.element(this);
                    // fire unbindListeners
                    var elmSettings = getEditableSettings(elm);
                    for(var l in _unbindListenerFncs){
                        elm = _unbindListenerFncs[l](elm, elmSettings);
                    }
                });
            }
            
            contentElm.find('[ne-editable-settings]').removeAttr('ne-editable-settings');
            contentElm.find('#ne-editable-style').remove();
            contentElm.find('script[type="text/ne-editable-config"]').remove();
            contentElm.find('script[type="text/ne-editable-template"]').remove();
            contentElm.find('script[type="text/ne-editable-script"]').remove();
            contentElm.find('[ne-editable-placeholder]').remove();
            contentElm.find('[ne-editable-button-wrapper]').remove();
            
            var content = contentElm.html();
            contentElm.remove();
            return content;
        }
        
        return this;
    }
}]);