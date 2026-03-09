import './lib/konva.min.js';
// 创建舞台
const stage = new Konva.Stage({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight - document.getElementsByClassName("navbar")[0].getBoundingClientRect().height,
});
const backgroundLayer = new Konva.Layer();
const layer = new Konva.Layer();
// 保存当前鼠标点击的target
var currentTarget = null;
function init() {
    konvaInit();
    flowerInit();
    // 形状
    
    // 形状添加到图层
    // layer.add(yoda);
    // 图层添加到舞台
    stage.add(layer);
}
// 图片资源加载
function flowerInit() {
    addImage('/static/flower1.png');
    addImage('/static/flower2.png');
    addImage('/static/flower3.png');
    addImage('/static/flower4.png');
    addImage('/static/flower5.png');
    addImage('/static/flower6.png');
    addImage('/static/flower7.png');
    addImage('/static/flower8.png');
    addImage('/static/leaf1.png');
    addImage('/static/leaf2.png');
    addImage('/static/leaf3.png');
    addImage('/static/leaf4.png');
}
function test() {
    var imageObj = new Image();
    imageObj.src = '/static/flower1.png';
    var yoda = new Konva.Image({
            scaleX: 0.1,
            scaleY: 0.1,
            image: imageObj,
            draggable: true,
            x: stage.width() / 2,
            y: stage.height() / 2,
            name: 'flower'
        });
    var transformer = new Konva.Transformer({
        node: yoda,
        keepRatio: true,
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        visible: false,
        name
    });
    layer.add(yoda);
    layer.add(transformer);
        
    
}
// 画布初始设置
function konvaInit() {
    // 点到背景的处理
    stage.on('click touchstart', function (e) {
        if (e.target == stage) {
            console.log('点击背景');
            if (currentTarget != null) {
                var transformer = layer.findOne('#' + currentTarget.id() + '-transformer');
                if (transformer != null) {
                    transformer.visible(false);
                }
                currentTarget = null;
            }
        }
    })
    var img = new Image();
    img.src = '/static/background.jpg';
    img.onload = function () {
        // 计算合适和图片缩放方式
        var scaleHeight = stage.height() / img.height;
        var scaleWidth = stage.width() / img.width;
        var scale = scaleHeight > scaleWidth ? scaleWidth : scaleHeight;
        var width = img.width * scale;
        var height = img.height * scale;
        var x = (stage.width() - width) / 2;
        var y = (stage.height() - height) / 2;
        var kImg = new Konva.Image({
            x: x,
            y: y,
            width: width,
            height: height,
            image: img,
            listening: false
        });
        backgroundLayer.add(kImg);
    }
    stage.add(backgroundLayer);
    stage.add(layer);
}
var count = 0;
// 添加图片到画布上,默认缩放0.1
function addImage(path) {
    var imageObj = new Image();
    var scale = 0.1
    imageObj.src = path;
    var flower = new Konva.Image({
            scaleX: scale,
            scaleY: scale,
            image: imageObj,
            draggable: true,
            x: (stage.width() - imageObj.width * scale) / 2,
            y: (stage.height() - imageObj.height * scale) / 2,
            id: 'flower' + count
        });
        // 处理点击或者触摸事件
        flower.on('click touchstart', function (e) {
            console.log('点击图片：' + e.target.id());
            // 上一个点击的是自己的话，取消选择
            /*if (currentTarget == e.target) {
                layer.findOne('#' + currentTarget.id() + '-transformer').visible(false);
                currentTarget = null;
                return;
            }*/
            if (currentTarget != null) {
                var transformer = layer.findOne('#' + currentTarget.id() + '-transformer');
                if (transformer != null) {
                    transformer.visible(false);
                }
            }
            currentTarget = e.target;
            layer.findOne('#' + currentTarget.id() + '-transformer').visible(true);
        })
    var transformer = new Konva.Transformer({
        node: flower,
        keepRatio: true,
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        visible: false,
        id: flower.id() + '-transformer'
    });
    console.log("添加图片：" + flower.id());
    layer.add(flower);
    console.log("添加缩放：" + transformer.id());
    layer.add(transformer);
    count++;
}
init();