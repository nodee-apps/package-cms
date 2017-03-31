angular.module('neEditable.image', ['neEditable', 'neModals','neLocal'])
.directive('editableOnImageLoad', function(){
    return {
        scope:{
            editableOnImageLoad:'&'
        },
        link: function(scope, elm, attrs){
            elm[0].addEventListener('load', triggerOnLoad);

            function triggerOnLoad(){
                scope.editableOnImageLoad({
                    naturalWidth: elm[0].naturalWidth,
                    naturalHeight: elm[0].naturalHeight
                });
            }

            scope.$on('$destroy', function(){
                elm[0].removeEventListener('load', triggerOnLoad);
            });
        }
    }
})
.controller('EditableImageCtrl', ['$scope', 'neModals', function($scope, modals){
    
    function init(){
        var img = $scope.container.ref;
        $scope.settings = $scope.container.editors.image;
        $scope.imgValues = $scope.editable.getElm(img);
        $scope.width = ($scope.container.editors.image || {}).width || parseInt(img[0].width!==img[0].naturalWidth ? img[0].width : img[0].naturalWidth, 10);
        $scope.height = ($scope.container.editors.image || {}).height || parseInt(img[0].height!==img[0].naturalHeight ? img[0].height : img[0].naturalHeight, 10);
        $scope.bg_color = (($scope.container.editors.image || {}).bg_color ? 'x' + ($scope.container.editors.image || {}).bg_color.replace('#', '') : '');
        $scope.resizeMode = ($scope.container.editors.image || {}).crop===true ? 'crop' : 'resize';
        $scope.widthAuto = ($scope.container.editors.image || {}).widthAuto;
        $scope.heightAuto = ($scope.container.editors.image || {}).heightAuto;
        
        $scope.attrName = ($scope.container.editors.image || {}).attr || 'src';
        $scope.src = $scope.imgValues.attr[ $scope.attrName ] || '/cmsimages/generate/'+($scope.width||'300')+'x'+($scope.height||'300')+'.jpg';
        $scope.valueAsId = ($scope.container.editors.image || {}).valueAsId;
        //$scope.setSrc($scope.imgValues.attr.src, true);
    }
    
    $scope.$on('neEditable:focus', function(){
        init();
        $scope.$digest();
    });
    
    //$scope.setSrc = function(src, onlyGetValue){
    //    $scope.src = src;
    //    if(!onlyGetValue) $scope.editable.updateElm($scope.container.ref, {attr:{ src:src }});
    //    
    //    var origImgId = $scope.src.match(/.*\/cmsimages\/([^\.\/]+)[\.\/].+$/) || [null];
    //    origImgId = origImgId[origImgId.length-1];
    //    var imgExt = $scope.src.match(/.*[\.]([a-z]+)$/) || [null];
    //    imgExt = imgExt[imgExt.length-1];
    //    if(origImgId) $scope.origImgUrl = '/cmsimages/' + origImgId + '.' +(imgExt || 'jpg');
    //    else $scope.origImgUrl = null;
    //};
    
    $scope.setSrc = function(src, imgId){
        var attrs = { 'e-image-id':imgId };
        attrs[ $scope.attrName ] = $scope.valueAsId ? imgId : src;
        $scope.editable.updateElm($scope.container.ref, {attr:attrs});
        //var img = $scope.container.ref;
        $scope.src = src;
    };
    
    // if template, and controller is loaded first time,
    // init have to be set manually, because editalbe:focus event was already fired
    init();
    
    $scope.setWidth = function(w){
        w = parseInt(w, 10);
        var update = {style:{ width: w+'px' }};
        if($scope.imgValues.attr && $scope.imgValues.attr.width)
            update.attr = { width:w };
        if(w) {
            $scope.editable.updateElm($scope.container.ref, update);
            $scope.width = w;
        }
    };
     
    $scope.setHeight = function(h){
        h = parseInt(h, 10);
        var update = {style:{ height: h+'px' }};
        if($scope.imgValues.attr && $scope.imgValues.attr.height)
            update.attr = { height:h };
        if(h) {
            $scope.editable.updateElm($scope.container.ref, update);
            $scope.height = h;
        }
    };
    
    $scope.setNaturalWidth = function(w){
        $scope.naturalWidth = w;
    };
    
    $scope.setNaturalHeight = function(h){
        $scope.naturalHeight = h;
    };
    
    //$scope.loadOriginal = function(){
    //    $scope.setSrc($scope.origImgUrl);
    //};
    
    //$scope.afterUpload = function(data){
    //    var ext = data.ext || 'jpg';
    //    var newUrl = '/cmsimages/' +data.id+ '/' +$scope.width+ 'x' +$scope.height+$scope.bg_color+ '.' +ext;
    //    $scope.setSrc(newUrl);
    //};
    
    $scope.changeImageModal = function(){
        modals.create({
            id:'editable.image.changeImage',
            title:'Change Image',
            include:'views/cms-images-modal.html',
            removeOnClose: true,
            //wide:true,
            insertImage: function(url, imgId){
                $scope.setSrc(url, imgId);
                modals.get('editable.image.changeImage').hide();
            },
            width: $scope.width,
            height: $scope.height,
            widthAuto: $scope.widthAuto,
            heightAuto: $scope.heightAuto,
            bg_color: $scope.bg_color,
            resize: {
                mode: $scope.resizeMode==='crop' ? { name:'crop', icon:'fa-crop' } : { name:'resize', icon:'fa-arrows-alt' },
                options:[{ name:'resize', icon:'fa-arrows-alt' }, { name:'crop', icon:'fa-crop' }]
            },
            url:'',
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
}]);