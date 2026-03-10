function createAssetCard(asset, { onAssetAdd, getLabel, addLabel }) {
  const label = getLabel(asset.id);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'asset-card';
  button.draggable = true;
  button.dataset.assetId = asset.id;
  button.setAttribute('aria-label', addLabel(label));

  const preview = document.createElement('img');
  preview.className = 'asset-card__preview';
  preview.src = asset.src;
  preview.alt = label;
  preview.loading = 'lazy';
  preview.decoding = 'async';

  const meta = document.createElement('div');
  meta.className = 'asset-card__meta';

  const title = document.createElement('strong');
  title.className = 'asset-card__title';
  title.textContent = label;

  meta.append(title);
  button.append(preview, meta);
  button.addEventListener('click', () => onAssetAdd(asset.id));
  button.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData('text/plain', asset.id);
    event.dataTransfer?.setData('application/x-aiya-petal-asset', asset.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  });

  return button;
}

function createFolderCard(folder, { isActive, onFolderOpen, getLabel, countLabel }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `folder-card${isActive ? ' is-active' : ''}`;
  button.dataset.folderId = folder.id;

  const icon = document.createElement('span');
  icon.className = 'folder-card__icon';
  icon.setAttribute('aria-hidden', 'true');

  const title = document.createElement('strong');
  title.className = 'folder-card__title';
  title.textContent = getLabel(folder.id);

  const count = document.createElement('span');
  count.className = 'folder-card__count';
  count.textContent = countLabel(folder.assetCount);

  button.append(icon, title, count);
  button.addEventListener('click', () => onFolderOpen(folder.id));
  return button;
}

function createGroupSection(group, options) {
  const section = document.createElement('section');
  section.className = 'folder-section';

  const header = document.createElement('header');
  header.className = 'folder-section__header';

  const title = document.createElement('h2');
  title.className = 'folder-section__title';
  title.textContent = options.getLabel(group.id);

  const grid = document.createElement('div');
  grid.className = 'folder-grid';

  group.folders.forEach((folder) => {
    grid.append(createFolderCard(folder, options));
  });

  header.append(title);
  section.append(header, grid);
  return section;
}

function createEmptyState(message) {
  const emptyState = document.createElement('p');
  emptyState.className = 'asset-browser__empty';
  emptyState.textContent = message;
  return emptyState;
}

export function renderAssetPalette({
  mountNode,
  groups,
  activeFolder,
  assets,
  isLoading,
  onFolderOpen,
  onAssetAdd,
  getLabel,
  messages,
}) {
  const browser = document.createElement('div');
  browser.className = 'asset-browser';

  const foldersPanel = document.createElement('div');
  foldersPanel.className = 'asset-browser__folders';
  foldersPanel.append(...groups.map((group) => createGroupSection(group, {
    isActive: activeFolder?.id,
    onFolderOpen,
    getLabel,
    countLabel: messages.folderCount,
  })));

  const content = document.createElement('section');
  content.className = 'asset-browser__content';

  const contentHeader = document.createElement('header');
  contentHeader.className = 'asset-browser__header';

  const title = document.createElement('h2');
  title.className = 'asset-browser__title';
  title.textContent = activeFolder ? getLabel(activeFolder.id) : messages.libraryTitle;

  const description = document.createElement('p');
  description.className = 'asset-browser__hint';
  description.textContent = activeFolder
    ? messages.folderCount(activeFolder.assetCount)
    : messages.folderHint;

  contentHeader.append(title, description);

  if (isLoading) {
    content.append(contentHeader, createEmptyState(messages.loading));
    browser.append(foldersPanel, content);
    mountNode.replaceChildren(browser);
    return;
  }

  if (!activeFolder || !assets.length) {
    content.append(contentHeader, createEmptyState(activeFolder ? messages.empty : messages.pickFolder));
    browser.append(foldersPanel, content);
    mountNode.replaceChildren(browser);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'asset-grid';
  assets.forEach((asset) => {
    grid.append(createAssetCard(asset, {
      onAssetAdd,
      getLabel,
      addLabel: messages.addAsset,
    }));
  });

  content.append(contentHeader, grid);
  browser.append(foldersPanel, content);
  mountNode.replaceChildren(browser);
}
