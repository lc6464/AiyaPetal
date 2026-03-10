const buildAssetUrl = (fileName) => new URL(`../../assets/${fileName}`, import.meta.url).href;
const buildDataUrl = (fileName) => new URL(`../../data/${fileName}`, import.meta.url).href;

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法加载配置文件: ${url}`);
  }

  return response.json();
}

function freezeBackgroundAsset(background) {
  return Object.freeze({
    id: background.id,
    src: buildAssetUrl(background.fileName),
    exportRegion: Object.freeze({ ...background.exportRegion }),
  });
}

function freezeFolder(folder) {
  return Object.freeze({
    ...folder,
    assetIds: Object.freeze([...folder.assetIds]),
    manifestUrl: buildDataUrl(`catalog/${folder.fileName}`),
  });
}

function freezeAsset(asset, folderId) {
  return Object.freeze({
    ...asset,
    folderId,
    src: buildAssetUrl(asset.fileName),
  });
}

export async function createAssetCatalog() {
  const manifest = await fetchJson(buildDataUrl('catalog/index.json'));
  return new AssetCatalog(manifest);
}

class AssetCatalog {
  #backgroundAsset;
  #groups;
  #folderIndex;
  #assetIndex = new Map();
  #assetToFolder = new Map();
  #folderAssetCache = new Map();

  constructor(manifest) {
    this.#backgroundAsset = freezeBackgroundAsset(manifest.background);

    const folders = manifest.folders.map(freezeFolder);
    this.#folderIndex = new Map(folders.map((folder) => [folder.id, folder]));
    this.#groups = Object.freeze(
      manifest.groups.map((group) => Object.freeze({
        ...group,
        folderIds: Object.freeze([...group.folderIds]),
      })),
    );

    folders.forEach((folder) => {
      folder.assetIds.forEach((assetId) => {
        this.#assetToFolder.set(assetId, folder.id);
      });
    });
  }

  getBackgroundAsset() {
    return this.#backgroundAsset;
  }

  getGroups() {
    return this.#groups.map((group) => ({
      ...group,
      folders: group.folderIds
        .map((folderId) => this.#folderIndex.get(folderId))
        .filter(Boolean),
    }));
  }

  getFolder(folderId) {
    return this.#folderIndex.get(folderId) ?? null;
  }

  async getFolderAssets(folderId) {
    if (this.#folderAssetCache.has(folderId)) {
      return this.#folderAssetCache.get(folderId);
    }

    const folder = this.getFolder(folderId);
    if (!folder) {
      throw new Error(`未知素材文件夹: ${folderId}`);
    }

    const manifest = await fetchJson(folder.manifestUrl);
    const assets = Object.freeze(
      manifest.assets.map((asset) => freezeAsset(asset, folderId)),
    );

    assets.forEach((asset) => {
      this.#assetIndex.set(asset.id, asset);
    });

    this.#folderAssetCache.set(folderId, assets);
    return assets;
  }

  async getAsset(assetId) {
    if (this.#assetIndex.has(assetId)) {
      return this.#assetIndex.get(assetId);
    }

    const folderId = this.#assetToFolder.get(assetId);
    if (!folderId) {
      return null;
    }

    await this.getFolderAssets(folderId);
    return this.#assetIndex.get(assetId) ?? null;
  }
}
