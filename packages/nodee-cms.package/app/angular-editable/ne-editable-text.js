angular.module('neEditable.text', ['neEditable','neContentEditors','neModals','textAngularSetup'])
.run(['$templateCache', '$window', 'taRegisterTool', 'taTranslations', 'taSelection', 'taToolFunctions', '$sanitize', 'taOptions','taTools','neModals', function($templateCache, $window, taRegisterTool, taTranslations, taSelection, taToolFunctions, $sanitize, taOptions, taTools, modals){

    taRegisterTool('insertCmsImage', {
        iconclass: 'fa fa-picture-o',
        tooltiptext: taTranslations.insertImage.tooltip,
        onElementSelect: {
            element: 'img',
            action: taToolFunctions.imgOnSelectAction
        }
    });

    taTools.insertCmsImage.action = function(deferred, restoreSelection){
        var ta = this;

        modals.create({
            id:'editable.richtext.insertImage',
            title:'Insert Image',
            include:'views/cms-images-modal.html',
            removeOnClose: true,
            //wide:true,
            onClose: function(){
                if(!this.inserted){
                    restoreSelection();
                    deferred.resolve();
                }
            },
            insertImage: function(url){
                this.inserted = true;
                restoreSelection();
                if(url && url !== '' && url !== 'http://') {
                    ta.$editor().wrapSelection('insertImage', url, true);
                }
                deferred.resolve();
                this.hide();
            },
            width: 200,
            height: 200,
            resize: {
                mode: { name:'resize', icon:'fa-arrows-alt' },
                options:[{ name:'resize', icon:'fa-arrows-alt' }, { name:'crop', icon:'fa-crop' }]
            },
            url:'',
            generateUrl:function(image){
                if(!image) return;
                this.url = '/cmsimages/' +image.id;
                if(this.width && this.height) this.url += '/'+ (this.resize.mode.name==='crop' ? 'cx' : '') +this.width+ 'x' +this.height+(this.bg_color ? 'x'+this.bg_color : '')+ '.' +image.ext;
                else this.url += '.' +image.ext;
                return this.url;
            }
        });

        return false;
    };

}])
.controller('EditableTextCtrl', ['$scope', 'neEditable', 'neMarkdown','neWysiwyg', 'neModals', function($scope, editable, markdown, wysiwyg, modals){
    
    $scope.taToolbar = [
        ['undo', 'redo'],
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'pre', 'quote', 'table'],
        ['bold', 'italics', 'underline', 'strikeThrough', 'ul', 'ol'],
        ['color', 'bgColor', 'clear'],
        ['justifyLeft','justifyCenter','justifyRight','justifyFull','indent','outdent'],
        ['insertCmsImage', 'insertLink', 'insertVideo'] // 'html', 'insertImage' -> 'insertCmsImage', 'wordcount', 'charcount'
    ];

    function init(){
        $scope.show = {
            wysiwyg: ($scope.container.editors.richtext || {}).wysiwyg,
            markdown: ($scope.container.editors.richtext || {}).markdown,
            html: ($scope.container.editors.richtext || {}).html
        };
        $scope.show.mode = ($scope.container.editors.richtext || {}).defaultMode || ($scope.container.editors.richtext || {}).mode;
        
        if(!$scope.show.mode && $scope.show.wysiwyg) $scope.show.mode = 'wysiwyg';
        if(!$scope.show.mode && $scope.show.markdown) $scope.show.mode = 'markdown';
        if(!$scope.show.mode && $scope.show.html) $scope.show.mode = 'html';
        
        var html = editable.getElm($scope.container.ref).html;
        $scope.content = {
            html: html,
            mdText: markdown.parseHTML(html)
        };
        $scope.selection = {};
    }
    
    $scope.$on('neEditable:focus', function(){
        init();
        $scope.$digest();
    });
    
    // if template, and controller is loaded first time,
    // init have to be set manually, because editalbe:focus event was already fired
    init();
    
    $scope.updateMD = function(md){
        $scope.content.mdText = md;
        var html = markdown.renderHTML(md);
        $scope.content.html = html; // ensure html is updated in all text editors
        editable.updateElm($scope.container.ref, { html:(html || '&nbsp;') });
    };
    
    $scope.updateHTML = function(html){
        $scope.content.mdText = markdown.parseHTML(html);
        editable.updateElm($scope.container.ref, { html:(html || '&nbsp;') });
    };
    
    $scope.mdEditor = markdown.editor;
    $scope.mdInsertImage = function(selection){
        insertImage(selection, function(url){
            $scope.updateMD(markdown.editor.image(selection, url));
        });
    };
    $scope.mdInsertLink = function(selection){
        insertLink(selection, function(url, name){
            $scope.updateMD(markdown.editor.link(selection, url, name));
        });
    };
    $scope.mdInsertTable = function(selection){
        insertTable(selection, function(cols, rows){
            $scope.updateMD(markdown.editor.table(selection, cols, rows));
        });
    };
    
    $scope.wsEditor = wysiwyg.editor;
    $scope.wsInsertImage = function(selection){
        insertImage(selection, function(url){
            $scope.updateHTML(wysiwyg.editor.image(selection, url));
        });
    };
    $scope.wsInsertLink = function(selection){
        insertLink(selection, function(url, name){
            $scope.updateHTML(wysiwyg.editor.link(selection, url, name));
        });
    };
    $scope.wsInsertTable = function(selection){
        insertTable(selection, function(cols, rows){
            $scope.updateHTML(wysiwyg.editor.table(selection, cols, rows));
        });
    };
    
    
    // modal helpers:
    function insertImage(selection, cb){
        if(arguments.length===1 && typeof arguments[0]==='function'){
            cb = arguments[0];
            selection = null;
        }
        
        modals.create({
            id:'editable.richtext.insertImage',
            title:'Insert Image',
            include:'views/cms-images-modal.html',
            removeOnClose: true,
            //wide:true,
            insertImage: function(url){
                cb(url);
                modals.get('editable.richtext.insertImage').hide();
            },
            width: 200,
            height: 200,
            //bg_color: $scope.bg_color,
            resize: {
                mode: $scope.resizeMode==='crop' ? { name:'crop', icon:'fa-crop' } : { name:'resize', icon:'fa-arrows-alt' },
                options:[{ name:'resize', icon:'fa-arrows-alt' }, { name:'crop', icon:'fa-crop' }]
            },
            url:'',
            generateUrl:function(image){
                if(!image) return;
                this.url = '/cmsimages/' +image.id;
                if(this.width && this.height) this.url += '/'+ (this.resize.mode.name==='crop' ? 'cx' : '') +this.width+ 'x' +this.height+(this.bg_color ? 'x'+this.bg_color : '')+ '.' +image.ext;
                else this.url += '.' +image.ext;
                return this.url;
            }
        });
    }
    
    function insertLink(selection, cb){
        if(arguments.length===1 && typeof arguments[0]==='function'){
            cb = arguments[0];
            selection = null;
        }
        
        modals.create({
            id:'editable.richtext.insertLink',
            title:'Insert Link',
            include:'views/cms-editable-richtext-link.html',
            removeOnClose: true,
            //wide:true,
            insertLink: function(url, name){
                cb(url, name);
                modals.get('editable.richtext.insertLink').hide();
            }
        });
    }
    
    function insertTable(selection, cb){
        if(arguments.length===1 && typeof arguments[0]==='function'){
            cb = arguments[0];
            selection = null;
        }
        
        modals.create({
            id:'editable.richtext.insertTable',
            title:'Insert Table',
            include:'views/cms-editable-richtext-table.html',
            removeOnClose: true,
            //wide:true,
            insertTable: function(cols, rows){
                cb(cols, rows);
                modals.get('editable.richtext.insertTable').hide();
            }
        });
    }
    
}]);