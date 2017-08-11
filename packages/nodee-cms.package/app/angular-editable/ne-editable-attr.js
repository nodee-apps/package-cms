angular.module('neEditable.attribute', ['neEditable'])
.controller('EditableAttributeCtrl',[ '$scope', 'neEditable', function($scope, editable){
    
    $scope.$on('neEditable:focus', function(){
        init();
        $scope.$digest();
    });
    
    // if template, and controller is loaded first time,
    // init have to be set manually, because editalbe:focus event was already fired
    init();
    
    function init(){
        $scope.attr = editable.getElm($scope.container.ref).attr;
    }
    
    $scope.updateAttr = function(attr){
        editable.updateElm($scope.container.ref, {attr:attr});
    };
}]);