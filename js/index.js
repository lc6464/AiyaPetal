import './lib/konva.min.js';
// 创建舞台
const stage = new Konva.Stage({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight
});
const backgroundLayer = new Konva.Layer();
var layers = [];
function init() {
    backgroundInit();
    layerInit();

    // 图层
    var layer = new Konva.Layer();
    // 形状
    const imageObj = new Image();
    imageObj.src = '/static/flower1.png';
    imageObj.onload = function () {
        const yoda = new Konva.Image({
            scaleX: 0.5,
            scaleY: 0.5,
            image: imageObj
        });
        layer.add(yoda);
    }
    // 形状添加到图层
    // layer.add(yoda);
    // 图层添加到舞台
    stage.add(layer);
}
// 延迟刷新指定图层
function batchDraw(layer) {
    layer.batchDarw();
}
// 延迟刷新所有图层
function batchDrawAll() {
    for (let i = 0; i < layers.length; i++) {
        layers[i].batchDraw();
    }
}
// 用于设置图层，默认3+1层
function layerInit() {
    layers = [
        new Konva.Layer(),
        new Konva.Layer(),
        new Konva.Layer(),
    ];
    for (let i = 0; i < layers.length; i++) {
        stage.add(layers[i]);
    }
}
// 背景设置
function backgroundInit() {
    stage.add(backgroundLayer);
    var imageObj = new Image();
    imageObj.src = '/static/background.jpg';
    stage.height = imageObj.height;
    stage.width = imageObj.width;
    imageObj.onload = function () {
        const yoda = new Konva.Image({
            image: imageObj
        });
        backgroundLayer.add(yoda);
    }
}

init();