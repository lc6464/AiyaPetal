const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class PressedFlowerStudio {
  #assetLoader;
  #mountNode;
  #frameNode;
  #resolveAssetLabel;
  #formatLayerLabel;
  #formatMessage;
  #onSelectionChange = null;
  #onLayersChange = null;
  #onStatusChange = null;
  #Konva = null;
  #stage = null;
  #mainLayer = null;
  #overlayLayer = null;
  #sceneGroup = null;
  #compositionGroup = null;
  #transformer = null;
  #backgroundNode = null;
  #selectedNode = null;
  #resizeObserver = null;
  #nodeSequence = 0;
  #backgroundAsset = null;
  #sceneMetrics = {
    width: 1,
    height: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  constructor({
    mountNode,
    frameNode,
    assetLoader,
    resolveAssetLabel,
    formatLayerLabel,
    formatMessage,
    onSelectionChange,
    onLayersChange,
    onStatusChange,
  }) {
    this.#mountNode = mountNode;
    this.#frameNode = frameNode;
    this.#assetLoader = assetLoader;
    this.#resolveAssetLabel = resolveAssetLabel;
    this.#formatLayerLabel = formatLayerLabel;
    this.#formatMessage = formatMessage;
    this.#onSelectionChange = onSelectionChange;
    this.#onLayersChange = onLayersChange;
    this.#onStatusChange = onStatusChange;
  }

  async initialize({ backgroundAsset }) {
    this.#Konva = globalThis.Konva;
    if (!this.#Konva) {
      throw new Error('Konva 未加载，无法初始化编辑器。');
    }

    this.#backgroundAsset = backgroundAsset;
    this.#createStage();
    this.#bindStageEvents();
    this.#bindResizeObserver();
    await this.#setBackground(backgroundAsset);
    this.#syncStageSize();
    this.#emitSelectionChange();
    this.#emitLayersChange();
    this.#setStatusByKey('status.initialHint');
  }

  refreshPresentation() {
    this.#emitSelectionChange();
    this.#emitLayersChange();
  }

  async addAsset(asset, { position, state, silent = false } = {}) {
    const image = await this.#assetLoader.load(asset.src);
    const node = this.#createCompositionNode(asset, image, {
      position: state
        ? { x: state.x, y: state.y }
        : position ?? this.getCanvasCenter(),
      state,
    });

    this.#compositionGroup.add(node);
    this.#bindNodeEvents(node);
    this.selectNode(node);
    this.#emitLayersChange();
    this.#requestDraw();

    if (!silent) {
      this.#setStatusByKey('status.added', { label: this.#getAssetLabel(asset.id) });
    }

    return node;
  }

  selectNode(node) {
    if (this.#selectedNode === node) {
      return;
    }

    this.#selectedNode = node;
    this.#transformer.nodes([node]);
    this.#emitSelectionChange();
    this.#emitLayersChange();
    this.#requestDraw();
  }

  selectLayer(layerId) {
    const node = this.#findNodeById(layerId);
    if (!node) {
      return false;
    }

    this.selectNode(node);
    return true;
  }

  clearSelection() {
    if (!this.#selectedNode) {
      return;
    }

    this.#selectedNode = null;
    this.#transformer.nodes([]);
    this.#emitSelectionChange();
    this.#emitLayersChange();
    this.#requestDraw();
    this.#setStatusByKey('status.selectionCleared');
  }

  duplicateSelection() {
    if (!this.#selectedNode) {
      return false;
    }

    const metadata = this.#createNodeMetadata();
    const clonedNode = this.#selectedNode.clone({
      id: metadata.id,
      x: this.#selectedNode.x() + 96,
      y: this.#selectedNode.y() + 96,
      assetId: this.#selectedNode.getAttr('assetId'),
      instanceIndex: metadata.instanceIndex,
      image: this.#selectedNode.image(),
    });

    this.#compositionGroup.add(clonedNode);
    this.#bindNodeEvents(clonedNode);
    this.selectNode(clonedNode);
    this.#emitLayersChange();
    this.#requestDraw();
    this.#setStatusByKey('status.duplicated', { label: this.#getNodeLabel(clonedNode) });
    return true;
  }

  removeSelection() {
    if (!this.#selectedNode) {
      return false;
    }

    const label = this.#getNodeLabel(this.#selectedNode);
    this.#selectedNode.destroy();
    this.#selectedNode = null;
    this.#transformer.nodes([]);
    this.#emitSelectionChange();
    this.#emitLayersChange();
    this.#requestDraw();
    this.#setStatusByKey('status.removed', { label });
    return true;
  }

  moveSelectionUp() {
    if (!this.#selectedNode) {
      return false;
    }

    const moved = this.#selectedNode.moveUp();
    if (!moved) {
      return false;
    }

    this.#emitLayersChange();
    this.#requestDraw();
    this.#setStatusByKey('status.layerMovedUp');
    return true;
  }

  moveSelectionDown() {
    if (!this.#selectedNode) {
      return false;
    }

    const moved = this.#selectedNode.moveDown();
    if (!moved) {
      return false;
    }

    this.#emitLayersChange();
    this.#requestDraw();
    this.#setStatusByKey('status.layerMovedDown');
    return true;
  }

  reorderLayer(layerId, targetIndex) {
    const node = this.#findNodeById(layerId);
    const children = this.#compositionGroup.getChildren();
    if (!node || targetIndex < 0 || targetIndex >= children.length) {
      return false;
    }

    const targetZIndex = children.length - 1 - targetIndex;
    node.setZIndex(targetZIndex);
    this.#emitLayersChange();
    this.#requestDraw();
    this.#setStatusByKey('status.layerReordered');
    return true;
  }

  rotateSelection(deltaDegrees) {
    if (!this.#selectedNode) {
      return false;
    }

    this.#selectedNode.rotation(this.#selectedNode.rotation() + deltaDegrees);
    this.#requestDraw();
    this.#emitSelectionChange();
    this.#setStatusByKey('status.rotatedTo', {
      rotation: Math.round(this.#selectedNode.rotation()),
    });
    return true;
  }

  nudgeSelection(deltaX, deltaY) {
    if (!this.#selectedNode) {
      return false;
    }

    this.#selectedNode.position({
      x: this.#selectedNode.x() + deltaX,
      y: this.#selectedNode.y() + deltaY,
    });

    this.#requestDraw();
    return true;
  }

  clearComposition({ silent = false } = {}) {
    this.#compositionGroup.destroyChildren();
    this.#selectedNode = null;
    this.#transformer.nodes([]);
    this.#emitSelectionChange();
    this.#emitLayersChange();
    this.#requestDraw();

    if (!silent) {
      this.#setStatusByKey('status.canvasCleared');
    }
  }

  serializeComposition(metadata = {}) {
    return {
      type: 'eleflower-composition',
      version: 1,
      backgroundId: this.#backgroundAsset?.id ?? '',
      metadata,
      items: this.#compositionGroup.getChildren().map((node) => ({
        id: node.id(),
        assetId: node.getAttr('assetId'),
        instanceIndex: node.getAttr('instanceIndex'),
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      })),
    };
  }

  async loadComposition(document, { resolveAssetById }) {
    if (!document || document.type !== 'eleflower-composition' || !Array.isArray(document.items)) {
      throw new Error('不是有效的导入文件。');
    }

    this.clearComposition({ silent: true });

    for (const item of document.items) {
      const asset = await resolveAssetById(item.assetId);
      if (!asset) {
        throw new Error(`缺少素材 ${item.assetId}`);
      }

      await this.addAsset(asset, { state: item, silent: true });
    }

    if (this.#selectedNode) {
      this.#selectedNode = null;
      this.#transformer.nodes([]);
    }

    this.#emitSelectionChange();
    this.#emitLayersChange();
    this.#requestDraw();
    this.#setStatusByKey('status.importDone', { count: document.items.length });
  }

  exportCompositionImage({ pixelRatio = 2 } = {}) {
    const crop = this.#getExportCropRect();
    return this.#mainLayer.toDataURL({
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      pixelRatio,
    });
  }

  toStagePoint({ clientX, clientY }) {
    const bounds = this.#mountNode.getBoundingClientRect();
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    const sceneX = (localX - this.#sceneMetrics.offsetX) / this.#sceneMetrics.scale;
    const sceneY = (localY - this.#sceneMetrics.offsetY) / this.#sceneMetrics.scale;

    return {
      x: clamp(sceneX, 0, this.#sceneMetrics.width),
      y: clamp(sceneY, 0, this.#sceneMetrics.height),
    };
  }

  getCanvasCenter() {
    return {
      x: this.#sceneMetrics.width / 2,
      y: this.#sceneMetrics.height / 2,
    };
  }

  getLayersState() {
    return this.#compositionGroup.getChildren().slice().reverse().map((node) => ({
      id: node.id(),
      label: this.#formatLayerLabel({
        assetId: node.getAttr('assetId'),
        label: this.#getNodeLabel(node),
        instanceIndex: node.getAttr('instanceIndex'),
      }),
      isSelected: node === this.#selectedNode,
    }));
  }

  getSelectionState() {
    if (!this.#selectedNode) {
      return {
        hasSelection: false,
        label: '',
        rotation: 0,
      };
    }

    return {
      hasSelection: true,
      label: this.#getNodeLabel(this.#selectedNode),
      rotation: Math.round(this.#selectedNode.rotation()),
    };
  }

  #createStage() {
    const Konva = this.#Konva;
    this.#stage = new Konva.Stage({
      container: this.#mountNode,
      width: 1,
      height: 1,
    });

    this.#mainLayer = new Konva.Layer();
    this.#overlayLayer = new Konva.Layer();
    this.#sceneGroup = new Konva.Group({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    this.#compositionGroup = new Konva.Group();

    this.#transformer = new Konva.Transformer({
      rotateEnabled: true,
      keepRatio: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      anchorSize: 20,
      padding: 14,
      rotateAnchorOffset: 44,
      anchorCornerRadius: 10,
      anchorFill: '#f0ede3',
      anchorStroke: '#1a3a32',
      anchorStrokeWidth: 1.5,
      borderStroke: '#1a3a32',
      borderDash: [8, 6],
      centeredScaling: false,
      ignoreStroke: true,
    });

    this.#sceneGroup.add(this.#compositionGroup);
    this.#mainLayer.add(this.#sceneGroup);
    this.#overlayLayer.add(this.#transformer);
    this.#stage.add(this.#mainLayer, this.#overlayLayer);
  }

  #bindStageEvents() {
    this.#stage.on('click tap', (event) => {
      if (event.target === this.#stage || event.target === this.#backgroundNode) {
        this.clearSelection();
      }
    });
  }

  #bindResizeObserver() {
    this.#resizeObserver = new ResizeObserver(() => {
      this.#syncStageSize();
    });

    this.#resizeObserver.observe(this.#frameNode);
  }

  async #setBackground(backgroundAsset) {
    const image = await this.#assetLoader.load(backgroundAsset.src);
    const Konva = this.#Konva;
    this.#sceneMetrics.width = image.naturalWidth || image.width;
    this.#sceneMetrics.height = image.naturalHeight || image.height;

    if (!this.#backgroundNode) {
      this.#backgroundNode = new Konva.Image({
        x: 0,
        y: 0,
        image,
        listening: true,
        name: 'canvas-background',
      });
      this.#sceneGroup.add(this.#backgroundNode);
      this.#backgroundNode.moveToBottom();
    } else {
      this.#backgroundNode.image(image);
    }

    this.#backgroundNode.setAttrs({
      width: this.#sceneMetrics.width,
      height: this.#sceneMetrics.height,
      opacity: 0.96,
    });
  }

  #createCompositionNode(asset, image, { position, state }) {
    const Konva = this.#Konva;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const metadata = this.#createNodeMetadata(state?.instanceIndex);
    const fallbackScale = clamp(300 / Math.max(imageWidth, imageHeight), 0.28, 0.72);
    const scaleX = state?.scaleX ?? asset.defaultScale ?? fallbackScale;
    const scaleY = state?.scaleY ?? asset.defaultScale ?? fallbackScale;

    return new Konva.Image({
      id: state?.id ?? metadata.id,
      image,
      x: position.x,
      y: position.y,
      rotation: state?.rotation ?? 0,
      offsetX: imageWidth / 2,
      offsetY: imageHeight / 2,
      scaleX,
      scaleY,
      draggable: true,
      shadowColor: 'rgba(16, 37, 32, 0.18)',
      shadowBlur: 24,
      shadowOffset: { x: 0, y: 12 },
      name: 'composition-item',
      assetId: asset.id,
      instanceIndex: metadata.instanceIndex,
    });
  }

  #bindNodeEvents(node) {
    node.on('mousedown touchstart dragstart transformstart', () => {
      this.selectNode(node);
    });

    node.on('dragstart transformstart', () => {
      this.#mountNode.classList.add('is-dragging');
      this.#mountNode.style.cursor = 'grabbing';
    });

    node.on('transform dragmove', () => {
      if (node === this.#selectedNode) {
        this.#emitSelectionChange();
      }
      this.#requestDraw();
    });

    node.on('dragend transformend', () => {
      this.#mountNode.classList.remove('is-dragging');
      this.#mountNode.style.cursor = 'default';
      this.#emitSelectionChange();
      this.#requestDraw();
    });
  }

  #syncStageSize() {
    if (!this.#stage) {
      return;
    }

    const frameStyles = getComputedStyle(this.#frameNode);
    const availableWidth = Math.max(
      this.#frameNode.clientWidth - parseFloat(frameStyles.paddingLeft) - parseFloat(frameStyles.paddingRight),
      1,
    );
    const availableHeight = Math.max(
      this.#frameNode.clientHeight - parseFloat(frameStyles.paddingTop) - parseFloat(frameStyles.paddingBottom),
      1,
    );
    const sceneRatio = this.#sceneMetrics.width / this.#sceneMetrics.height;
    const availableRatio = availableWidth / availableHeight;

    const width = availableRatio > sceneRatio
      ? availableHeight * sceneRatio
      : availableWidth;
    const height = availableRatio > sceneRatio
      ? availableHeight
      : availableWidth / sceneRatio;

    this.#mountNode.style.width = `${Math.max(width, 1)}px`;
    this.#mountNode.style.height = `${Math.max(height, 1)}px`;
    this.#stage.size({ width: Math.max(width, 1), height: Math.max(height, 1) });

    const sceneScale = Math.min(width / this.#sceneMetrics.width, height / this.#sceneMetrics.height);
    this.#sceneMetrics.scale = sceneScale;
    this.#sceneMetrics.offsetX = (width - this.#sceneMetrics.width * sceneScale) / 2;
    this.#sceneMetrics.offsetY = (height - this.#sceneMetrics.height * sceneScale) / 2;

    this.#sceneGroup.setAttrs({
      x: this.#sceneMetrics.offsetX,
      y: this.#sceneMetrics.offsetY,
      scaleX: sceneScale,
      scaleY: sceneScale,
    });

    this.#requestDraw();
  }

  #getExportCropRect() {
    const region = this.#backgroundAsset?.exportRegion;
    if (!region) {
      return {
        x: 0,
        y: 0,
        width: this.#stage.width(),
        height: this.#stage.height(),
      };
    }

    return {
      x: this.#sceneMetrics.offsetX + this.#sceneMetrics.width * region.x * this.#sceneMetrics.scale,
      y: this.#sceneMetrics.offsetY + this.#sceneMetrics.height * region.y * this.#sceneMetrics.scale,
      width: this.#sceneMetrics.width * region.width * this.#sceneMetrics.scale,
      height: this.#sceneMetrics.height * region.height * this.#sceneMetrics.scale,
    };
  }

  #emitSelectionChange() {
    this.#onSelectionChange?.(this.getSelectionState());
  }

  #emitLayersChange() {
    this.#onLayersChange?.(this.getLayersState());
  }

  #requestDraw() {
    this.#mainLayer?.batchDraw();
    this.#overlayLayer?.batchDraw();
  }

  #setStatus(message) {
    this.#onStatusChange?.(message);
  }

  #setStatusByKey(key, values = {}) {
    this.#setStatus(this.#formatMessage(key, values));
  }

  #createNodeMetadata(instanceIndex = null) {
    const nextIndex = instanceIndex ?? this.#nodeSequence + 1;
    this.#nodeSequence = Math.max(this.#nodeSequence, nextIndex);
    return {
      id: `specimen-${nextIndex}`,
      instanceIndex: nextIndex,
    };
  }

  #getAssetLabel(assetId) {
    return this.#resolveAssetLabel?.(assetId) ?? assetId;
  }

  #getNodeLabel(node) {
    return this.#getAssetLabel(node.getAttr('assetId'));
  }

  #findNodeById(nodeId) {
    return this.#compositionGroup.getChildren().find((node) => node.id() === nodeId) ?? null;
  }
}
