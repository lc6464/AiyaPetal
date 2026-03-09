import './lib/konva.min.js';
// 创建舞台
const stage = new Konva.Stage({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight - document.getElementsByClassName("navbar")[0].getBoundingClientRect().height,
});
const backgroundLayer = new Konva.Layer();
const layer = new Konva.Layer();
function init() {
    konvaInit();

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
// 画布初始设置
function konvaInit() {
    var img = new Image();
    img.src = '/static/background.jpg';
    img.onload = function () {
        // 计算合适和图片缩放方式
    }
    var kImg = new Konva.Image({
        x: 0,
        y: 0,
        image: img,
        width: stage.width(),
        height: stage.height(),
        listening: false
    });
    backgroundLayer.add(kImg);
    stage.add(backgroundLayer);
    stage.add(layer);
}

init();