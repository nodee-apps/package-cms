angular.module('neEditable.container', ['neEditable', 'neModals'])
.run([ 'neEditable', function(editable){
    // add listener to editable elm, if elm is editable-placeholder with templates
    
    editable.addBindListener(function(elm, editSettings){
        if(editSettings.container){
            var placeholder = editSettings.container.placeholder || {};
            var plElm = angular.element('<' +(placeholder.tag || 'div')+ ' style="' +(placeholder.style || '')+ '" ne-editable-placeholder>' +
                                '<div style="width:100%;height:100%;min-height:22px;min-width:22px;cursor:pointer;">' +
                                '<span style="display:inline-block;height:100%;vertical-align:middle;"></span>' +
                                //'<img style="display:inline-block;height:auto;max-width:100%;vertical-align:middle;" src="/admin/images/areas/cms/add_block.png" />' +
                                '</div>' +
                                '</'+(placeholder.tag || 'div')+'>');
            elm.append(plElm);
            return plElm;
        }
    });
    
    editable.addAfterBindListener(function(parentElm, editSettings){
        var containers = parentElm.find('[ne-editable-settings]').andSelf().filter('[ne-editable-settings*="container"]');
        containers.each(function(){
            var container = angular.element(this);
            var contSettings = editable.getEditableSettings(container);
            
            container.children('[ne-editable-settings*="block"]').each(function(){
                var block = angular.element(this);
                var editSettings = editable.getEditableSettings(block);
                editSettings.block.templates = contSettings.container.templates || editSettings.block.templates || [];
                editSettings.block.templateTypes = contSettings.container.templateTypes || editSettings.block.templateTypes || [];
                block.attr('ne-editable-settings', JSON.stringify(editSettings));
            });
        });
    });
}]);