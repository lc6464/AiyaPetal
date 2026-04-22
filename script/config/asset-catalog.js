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
  const imageWidth = Math.max(Number(background.imageWidth) || 1, 1);
  const imageHeight = Math.max(Number(background.imageHeight) || 1, 1);
  const rawCropWidth = Number(background.cropRect?.width) || imageWidth;
  const rawCropHeight = Number(background.cropRect?.height) || imageHeight;
  const cropWidth = Math.min(Math.max(rawCropWidth, 1), imageWidth);
  const cropHeight = Math.min(Math.max(rawCropHeight, 1), imageHeight);
  const cropX = Math.min(Math.max(Number(background.cropRect?.x) || 0, 0), imageWidth - cropWidth);
  const cropY = Math.min(Math.max(Number(background.cropRect?.y) || 0, 0), imageHeight - cropHeight);

  return Object.freeze({
    id: background.id,
    fileName: background.fileName,
    src: buildAssetUrl(background.fileName),
    imageWidth,
    imageHeight,
    cropRect: Object.freeze({
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    }),
    exportRegion: Object.freeze({
      x: cropX / imageWidth,
      y: cropY / imageHeight,
      width: cropWidth / imageWidth,
      height: cropHeight / imageHeight,
    }),
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
  const [manifest, backgroundManifest] = await Promise.all([
    fetchJson(buildDataUrl('catalog/index.json')),
    fetchJson(buildDataUrl('catalog/backgrounds.json')),
  ]);

  return new AssetCatalog(manifest, backgroundManifest);
}

class AssetCatalog {
  #backgrounds;
  #backgroundIndex;
  #defaultBackgroundId;
  #groups;
  #folderIndex;
  #assetIndex = new Map();
  #assetToFolder = new Map();
  #folderAssetCache = new Map();

  constructor(manifest, backgroundManifest) {
    this.#backgrounds = Object.freeze(
      (backgroundManifest.backgrounds ?? []).map(freezeBackgroundAsset),
    );
    this.#backgroundIndex = new Map(this.#backgrounds.map((background) => [background.id, background]));
    this.#defaultBackgroundId = manifest.defaultBackgroundId
      ?? backgroundManifest.defaultBackgroundId
      ?? this.#backgrounds[0]?.id
      ?? '';

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
    return this.getBackground(this.#defaultBackgroundId) ?? this.#backgrounds[0] ?? null;
  }

  getBackgrounds() {
    return [...this.#backgrounds];
  }

  getBackground(backgroundId) {
    return this.#backgroundIndex.get(backgroundId) ?? null;
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
