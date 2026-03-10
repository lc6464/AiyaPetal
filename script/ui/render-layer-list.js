const LAYER_DRAG_TYPE = 'application/x-eleflower-layer';

function createEmptyState(label) {
  const emptyState = document.createElement('p');
  emptyState.className = 'layer-list--empty';
  emptyState.textContent = label;
  return emptyState;
}

function createLayerItem(layer, displayIndex, { onSelect, onReorder }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `layer-item${layer.isSelected ? ' is-active' : ''}`;
  button.draggable = true;
  button.dataset.layerId = layer.id;

  const handle = document.createElement('span');
  handle.className = 'layer-item__handle';
  handle.textContent = '⋮⋮';

  const label = document.createElement('span');
  label.className = 'layer-item__label';
  label.textContent = layer.label;

  button.append(handle, label);
  button.addEventListener('click', () => onSelect(layer.id));
  button.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(LAYER_DRAG_TYPE, layer.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  });
  button.addEventListener('dragover', (event) => {
    event.preventDefault();
    button.classList.add('is-drop-target');
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  });
  button.addEventListener('dragleave', () => {
    button.classList.remove('is-drop-target');
  });
  button.addEventListener('drop', (event) => {
    event.preventDefault();
    button.classList.remove('is-drop-target');

    const sourceId = event.dataTransfer?.getData(LAYER_DRAG_TYPE) ?? '';
    if (!sourceId || sourceId === layer.id) {
      return;
    }

    onReorder(sourceId, displayIndex);
  });

  return button;
}

export function renderLayerList({ mountNode, layers, onSelect, onReorder, emptyLabel }) {
  if (!layers.length) {
    mountNode.replaceChildren(createEmptyState(emptyLabel));
    return;
  }

  mountNode.replaceChildren(
    ...layers.map((layer, displayIndex) => createLayerItem(layer, displayIndex, { onSelect, onReorder })),
  );
}
