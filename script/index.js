import 'konva';

import { createAssetCatalog } from '@app/config/asset-catalog.js';
import { AssetLoader } from '@app/core/asset-loader.js';
import { PressedFlowerStudio } from '@app/editor/PressedFlowerStudio.js';
import { I18nService, syncLocaleSelect } from '@app/i18n/I18nService.js';
import { renderLayerList } from '@app/ui/render-layer-list.js';
import { renderAssetPalette } from '@app/ui/render-palette.js';
import { bindToolbar, updateToolbarState } from '@app/ui/toolbar.js';

function assertHTMLElement(element, message) {
    if (!(element instanceof HTMLElement)) {
        throw new Error(message);
    }

    return element;
}

function updateStatus(statusNode, message) {
    statusNode.textContent = message;
}

function resolveDraggedAssetId(event) {
    return event.dataTransfer?.getData('application/x-aiya-petal-asset')
        || event.dataTransfer?.getData('text/plain')
        || '';
}

function downloadBlob(fileName, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createExportFileName(baseName, extension) {
    const now = new Date();
    const parts = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ];

    return `${baseName}-${parts.join('')}.${extension}`;
}

async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
}

function createPaletteMessages(i18n) {
    return {
        libraryTitle: i18n.t('studio.assetLibrary'),
        folderHint: i18n.t('studio.folderHint'),
        pickFolder: i18n.t('studio.folderEmpty'),
        loading: i18n.t('studio.folderLoading'),
        empty: i18n.t('studio.folderEmpty'),
        folderCount: (count) => i18n.t('studio.folderAssetCount', { count }),
        addAsset: (label) => i18n.t('studio.addAsset', { label }),
    };
}

function handleAppError(statusNode, i18n, error) {
    console.error(error);
    updateStatus(
        statusNode,
        i18n.t('status.loadFailed', {
            message: error instanceof Error ? error.message : i18n.t('status.initFailed'),
        }),
    );
}

function bindDropZone(dropZone, studio, catalog, statusNode, i18n) {
    const activate = () => dropZone.classList.add('is-drop-target');
    const deactivate = () => dropZone.classList.remove('is-drop-target');

    dropZone.addEventListener('dragenter', (event) => {
        event.preventDefault();
        activate();
    });

    dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        activate();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    });

    dropZone.addEventListener('dragleave', (event) => {
        if (!dropZone.contains(event.relatedTarget)) {
            deactivate();
        }
    });

    dropZone.addEventListener('drop', async (event) => {
        event.preventDefault();
        deactivate();

        const assetId = resolveDraggedAssetId(event);
        if (!assetId) {
            return;
        }

        try {
            const asset = await catalog.getAsset(assetId);
            if (!asset) {
                return;
            }

            await studio.addAsset(asset, {
                position: studio.toStagePoint({ clientX: event.clientX, clientY: event.clientY }),
            });
        } catch (error) {
            handleAppError(statusNode, i18n, error);
        }
    });
}

function bindKeyboardShortcuts(studio) {
    window.addEventListener('keydown', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('input, textarea, select, button')) {
            return;
        }

        const primaryModifier = event.ctrlKey || event.metaKey;
        const nudgeStep = event.shiftKey ? 24 : 12;

        if (primaryModifier && event.key.toLowerCase() === 'd') {
            if (studio.duplicateSelection()) {
                event.preventDefault();
            }
            return;
        }

        switch (event.key) {
            case 'Delete':
            case 'Backspace':
                if (studio.removeSelection()) {
                    event.preventDefault();
                }
                break;
            case 'Escape':
                studio.clearSelection();
                break;
            case 'ArrowUp':
                if (studio.nudgeSelection(0, -nudgeStep)) {
                    event.preventDefault();
                }
                break;
            case 'ArrowDown':
                if (studio.nudgeSelection(0, nudgeStep)) {
                    event.preventDefault();
                }
                break;
            case 'ArrowLeft':
                if (studio.nudgeSelection(-nudgeStep, 0)) {
                    event.preventDefault();
                }
                break;
            case 'ArrowRight':
                if (studio.nudgeSelection(nudgeStep, 0)) {
                    event.preventDefault();
                }
                break;
            default:
                break;
        }
    });
}

async function main() {
    const stageHost = assertHTMLElement(document.querySelector('[data-stage-host]'), '缺少画布容器。');
    const dropZone = assertHTMLElement(document.querySelector('[data-stage-dropzone]'), '缺少放置区域。');
    const paletteNode = assertHTMLElement(document.querySelector('[data-asset-palette]'), '缺少素材面板。');
    const layerListNode = assertHTMLElement(document.querySelector('[data-layer-list]'), '缺少图层栏。');
    const toolbarNode = assertHTMLElement(document.querySelector('[data-toolbar]'), '缺少工具栏。');
    const statusNode = assertHTMLElement(document.querySelector('[data-status]'), '缺少状态栏。');
    const localeSelect = document.querySelector('[data-locale-select]');
    const importInput = document.querySelector('[data-import-input]');

    const i18n = new I18nService({
        translationsUrl: new URL('../data/i18n/translations.json', import.meta.url).href,
    });
    await i18n.initialize();

    updateStatus(statusNode, i18n.t('status.loading'));

    const catalog = await createAssetCatalog();
    const assetLoader = new AssetLoader();
    await assetLoader.preloadAll([catalog.getBackgroundAsset().src]);

    let activeFolderId = null;
    let activeFolderAssets = [];
    let isLoadingFolder = false;

    const studio = new PressedFlowerStudio({
        mountNode: stageHost,
        frameNode: dropZone,
        assetLoader,
        resolveAssetLabel: (assetId) => i18n.label(assetId, {}, assetId),
        formatLayerLabel: ({ label, instanceIndex }) => i18n.t('layer.itemLabel', {
            label,
            index: String(instanceIndex).padStart(2, '0'),
        }),
        formatMessage: (key, values = {}) => i18n.t(key, values),
        onSelectionChange: (selectionState) => {
            updateToolbarState(toolbarNode, selectionState, {
                emptyLabel: i18n.t('toolbar.selectionNone'),
                formatSelection: ({ label, rotation }) => i18n.t('toolbar.selectionSummary', { label, rotation }),
            });
        },
        onLayersChange: (layers) => {
            renderLayerList({
                mountNode: layerListNode,
                layers,
                emptyLabel: i18n.t('layer.empty'),
                onSelect: (layerId) => {
                    studio.selectLayer(layerId);
                },
                onReorder: (layerId, targetIndex) => {
                    studio.reorderLayer(layerId, targetIndex);
                },
            });
        },
        onStatusChange: (message) => {
            updateStatus(statusNode, message);
        },
    });

    await studio.initialize({ backgroundAsset: catalog.getBackgroundAsset() });

    const renderPalette = () => {
        renderAssetPalette({
            mountNode: paletteNode,
            groups: catalog.getGroups(),
            activeFolder: activeFolderId ? catalog.getFolder(activeFolderId) : null,
            assets: activeFolderAssets,
            isLoading: isLoadingFolder,
            onFolderOpen: openFolder,
            onAssetAdd: addAssetById,
            getLabel: (id) => i18n.label(id, {}, id),
            messages: createPaletteMessages(i18n),
        });
    };

    async function addAssetById(assetId, options = {}) {
        const asset = await catalog.getAsset(assetId);
        if (!asset) {
            return;
        }

        await studio.addAsset(asset, options);
    }

    async function openFolder(folderId) {
        if (activeFolderId === folderId && activeFolderAssets.length) {
            return;
        }

        activeFolderId = folderId;
        isLoadingFolder = true;
        renderPalette();

        try {
            activeFolderAssets = await catalog.getFolderAssets(folderId);
            updateStatus(statusNode, i18n.t('status.folderLoaded', { label: i18n.label(folderId, {}, folderId) }));
        } catch (error) {
            handleAppError(statusNode, i18n, error);
        } finally {
            isLoadingFolder = false;
            renderPalette();
        }
    }

    bindToolbar({
        root: toolbarNode,
        actions: {
            'move-up': () => {
                studio.moveSelectionUp();
            },
            'move-down': () => {
                studio.moveSelectionDown();
            },
            duplicate: () => {
                studio.duplicateSelection();
            },
            'rotate-left': () => {
                studio.rotateSelection(-15);
            },
            'rotate-right': () => {
                studio.rotateSelection(15);
            },
            remove: () => {
                studio.removeSelection();
            },
            'clear-canvas': () => {
                studio.clearComposition();
            },
            'import-json': () => {
                if (importInput instanceof HTMLInputElement) {
                    importInput.click();
                }
            },
            'export-json': async () => {
                const blob = new Blob([
                    JSON.stringify(
                        studio.serializeComposition({
                            locale: i18n.getLocale(),
                            exportedAt: new Date().toISOString(),
                        }),
                        null,
                        2,
                    ),
                ], { type: 'application/json' });

                downloadBlob(createExportFileName('aiya-petal-layout', 'aiya-petal.json'), blob);
                updateStatus(statusNode, i18n.t('status.exportJsonDone'));
            },
            'export-image': async () => {
                const imageBlob = await dataUrlToBlob(studio.exportCompositionImage({ pixelRatio: 4 }));
                downloadBlob(createExportFileName('aiya-petal-bookmark', 'png'), imageBlob);
                updateStatus(statusNode, i18n.t('status.exportImageDone'));
            },
        },
    });

    if (importInput instanceof HTMLInputElement) {
        importInput.addEventListener('change', async () => {
            const [file] = importInput.files ?? [];
            if (!file) {
                return;
            }

            try {
                const content = await file.text();
                const document = JSON.parse(content);
                await studio.loadComposition(document, {
                    resolveAssetById: (assetId) => catalog.getAsset(assetId),
                });
            } catch (error) {
                updateStatus(statusNode, i18n.t('status.importFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }));
            } finally {
                importInput.value = '';
            }
        });
    }

    bindDropZone(dropZone, studio, catalog, statusNode, i18n);
    bindKeyboardShortcuts(studio);

    const applyTranslations = () => {
        if (localeSelect instanceof HTMLSelectElement) {
            syncLocaleSelect(localeSelect, i18n);
        }

        i18n.applyTo(document);
        studio.refreshPresentation();
        renderPalette();
    };

    if (localeSelect instanceof HTMLSelectElement) {
        localeSelect.addEventListener('change', () => {
            i18n.setLocale(localeSelect.value);
        });
    }

    i18n.addEventListener('change', applyTranslations);
    applyTranslations();
    updateStatus(statusNode, i18n.t('status.assetsReady'));
}

main().catch((error) => {
    const statusNode = document.querySelector('[data-status]');
    console.error(error);
    if (statusNode instanceof HTMLElement) {
        statusNode.textContent = error instanceof Error ? error.message : '应用初始化失败。';
    }
});