/**
 * overlay-media-db.js
 * Motor compartido de almacenamiento persistente para medios del Overlay (OBS y Panel de Control).
 * - Flyers: optimizados en el navegador a WebP (máx. 980x720) y guardados en Firestore.
 * - Videos MP4/WebM: divididos en bloques binarios (Bytes) dentro de Firestore (plan Spark gratis).
 * - Caché local: persistencia en IndexedDB por navegador/OBS para cero re-descargas y limpieza automática al borrar assets.
 */

import { doc, getDoc, setDoc, deleteDoc, Bytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const MEDIA_LIBRARY_COLLECTION = "broadcast_overlays";
export const MEDIA_LIBRARY_DOC = "media_library_index";
export const CHUNK_SIZE_BYTES = 700 * 1024; // 700 KB por documento (límite Firestore: 1 MB)
export const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB máximo recomendado por video

const IDB_NAME = "lbl_overlay_assets_db";
const IDB_VERSION = 1;
const IDB_STORE = "assets";

let idbPromise = null;
const inFlightDownloads = new Map();

function openAssetsDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            return reject(new Error("IndexedDB no soportado en este navegador"));
        }
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return idbPromise;
}

export async function saveAssetToLocalDB(id, blob, mimeType) {
    try {
        const db = await openAssetsDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            tx.objectStore(IDB_STORE).put({ id, blob, mimeType, savedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("[OverlayMediaDB] No se pudo guardar en IndexedDB:", e);
    }
}

export async function getAssetFromLocalDB(id) {
    try {
        const db = await openAssetsDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readonly");
            const req = tx.objectStore(IDB_STORE).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return null;
    }
}

export async function deleteAssetFromLocalDB(id) {
    try {
        const db = await openAssetsDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            tx.objectStore(IDB_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {}
}

/**
 * Elimina de IndexedDB cualquier asset local que ya no exista en el catálogo compartido de Firestore.
 */
export async function pruneOrphanLocalAssets(validIdsSet, objectUrlMap = null) {
    try {
        const db = await openAssetsDB();
        const keys = await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readonly");
            const req = tx.objectStore(IDB_STORE).getAllKeys();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });

        const orphans = keys.filter((k) => !validIdsSet.has(k));
        if (orphans.length === 0) return;

        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            const store = tx.objectStore(IDB_STORE);
            orphans.forEach((k) => store.delete(k));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        if (objectUrlMap) {
            orphans.forEach((k) => {
                const existingUrl = objectUrlMap.get(k);
                if (existingUrl) {
                    try { URL.revokeObjectURL(existingUrl); } catch (_) {}
                    objectUrlMap.delete(k);
                }
            });
        }
    } catch (e) {}
}

/**
 * Redimensiona y comprime imágenes a WebP (máx. 980x720) en el navegador para ocupar ~80-180 KB.
 */
export async function optimizeImageToWebP(file, maxW = 980, maxH = 720, quality = 0.86) {
    return new Promise((resolve, reject) => {
        const imgUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                let targetW = img.naturalWidth || maxW;
                let targetH = img.naturalHeight || maxH;
                const ratio = Math.min(maxW / targetW, maxH / targetH, 1);
                targetW = Math.max(1, Math.round(targetW * ratio));
                targetH = Math.max(1, Math.round(targetH * ratio));

                const canvas = document.createElement("canvas");
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, targetW, targetH);

                canvas.toBlob(
                    (blob) => {
                        URL.revokeObjectURL(imgUrl);
                        if (blob) {
                            resolve({ blob, mimeType: blob.type || "image/webp" });
                        } else {
                            resolve({ blob: file, mimeType: file.type || "image/png" });
                        }
                    },
                    "image/webp",
                    quality
                );
            } catch (err) {
                URL.revokeObjectURL(imgUrl);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(imgUrl);
            reject(new Error("No se pudo decodificar la imagen seleccionada."));
        };
        img.src = imgUrl;
    });
}

/**
 * Sube un flyer o video a Firestore (dividido en bloques binarios) y lo cachea localmente en IndexedDB.
 */
export async function uploadSharedMediaAsset(file, firestoreDb, { uploadedBy = "staff", onProgress = null } = {}) {
    const isVideo =
        file.type.startsWith("video/") ||
        /\.(mp4|webm|m4v|mov)$/i.test(file.name || "");

    let finalBlob = file;
    let finalMime = file.type || (isVideo ? "video/mp4" : "image/png");

    if (!isVideo) {
        if (onProgress) onProgress(10);
        const optimized = await optimizeImageToWebP(file);
        finalBlob = optimized.blob;
        finalMime = optimized.mimeType;
    } else if (file.size > MAX_VIDEO_SIZE_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        throw new Error(`El video "${file.name}" pesa ${mb} MB. El máximo permitido para sincronizar gratis es 25 MB.`);
    }

    const buffer = await finalBlob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const totalChunks = Math.max(1, Math.ceil(uint8.byteLength / CHUNK_SIZE_BYTES));

    const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE_BYTES;
        const end = Math.min(uint8.byteLength, start + CHUNK_SIZE_BYTES);
        const slice = uint8.slice(start, end);

        await setDoc(doc(firestoreDb, MEDIA_LIBRARY_COLLECTION, `asset_chunk_${assetId}_${i}`), {
            assetId,
            index: i,
            bytes: Bytes.fromUint8Array(slice)
        });

        if (onProgress) {
            const pct = 15 + Math.round(((i + 1) / totalChunks) * 80);
            onProgress(pct);
        }
    }

    await saveAssetToLocalDB(assetId, finalBlob, finalMime);
    if (onProgress) onProgress(100);

    return {
        id: assetId,
        name: file.name || (isVideo ? "video.mp4" : "flyer.webp"),
        type: isVideo ? "video" : "image",
        mimeType: finalMime,
        sizeBytes: uint8.byteLength,
        chunksCount: totalChunks,
        durationSec: isVideo ? 0 : 8,
        uploadedBy,
        createdAt: Date.now()
    };
}

/**
 * Obtiene un ObjectURL reproducible para un asset (primero desde IndexedDB local; si falta, descarga de Firestore 1 sola vez).
 */
export async function resolveAssetPlayableUrl(asset, firestoreDb, objectUrlMap = null) {
    if (!asset || !asset.id) return null;

    if (objectUrlMap && objectUrlMap.has(asset.id)) {
        return objectUrlMap.get(asset.id);
    }

    // 1. Buscar en IndexedDB local (0 lecturas a Firestore)
    const cached = await getAssetFromLocalDB(asset.id);
    if (cached && cached.blob) {
        const url = URL.createObjectURL(cached.blob);
        if (objectUrlMap) objectUrlMap.set(asset.id, url);
        return url;
    }

    // 2. Evitar descargas paralelas duplicadas del mismo asset
    if (inFlightDownloads.has(asset.id)) {
        return inFlightDownloads.get(asset.id);
    }

    const downloadPromise = (async () => {
        try {
            const chunksCount = Math.max(1, Number(asset.chunksCount) || 1);
            const chunkArrays = new Array(chunksCount);
            let totalLen = 0;
            const BATCH_SIZE = 4;

            for (let start = 0; start < chunksCount; start += BATCH_SIZE) {
                const batchPromises = [];
                const end = Math.min(chunksCount, start + BATCH_SIZE);
                for (let i = start; i < end; i++) {
                    batchPromises.push(
                        getDoc(doc(firestoreDb, MEDIA_LIBRARY_COLLECTION, `asset_chunk_${asset.id}_${i}`)).then((snap) => {
                            if (!snap.exists()) {
                                throw new Error(`Falta el bloque ${i} del asset ${asset.id}`);
                            }
                            const rawBytes = snap.data().bytes;
                            const u8 = rawBytes && typeof rawBytes.toUint8Array === "function"
                                ? rawBytes.toUint8Array()
                                : new Uint8Array(rawBytes || []);
                            chunkArrays[i] = u8;
                            totalLen += u8.byteLength;
                        })
                    );
                }
                await Promise.all(batchPromises);
            }

            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const part of chunkArrays) {
                merged.set(part, offset);
                offset += part.byteLength;
            }

            const mimeType = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/webp");
            const blob = new Blob([merged], { type: mimeType });
            await saveAssetToLocalDB(asset.id, blob, mimeType);

            const url = URL.createObjectURL(blob);
            if (objectUrlMap) objectUrlMap.set(asset.id, url);
            return url;
        } finally {
            inFlightDownloads.delete(asset.id);
        }
    })();

    inFlightDownloads.set(asset.id, downloadPromise);
    return downloadPromise;
}

/**
 * Elimina un asset de Firestore (todos sus bloques binarios) y de la caché IndexedDB local.
 */
export async function deleteSharedMediaAsset(asset, firestoreDb, objectUrlMap = null) {
    if (!asset || !asset.id) return;
    const chunksCount = Math.max(1, Number(asset.chunksCount) || 1);

    const deleteOps = [];
    for (let i = 0; i < chunksCount; i++) {
        deleteOps.push(
            deleteDoc(doc(firestoreDb, MEDIA_LIBRARY_COLLECTION, `asset_chunk_${asset.id}_${i}`)).catch(() => {})
        );
    }
    await Promise.all(deleteOps);
    await deleteAssetFromLocalDB(asset.id);

    if (objectUrlMap && objectUrlMap.has(asset.id)) {
        try { URL.revokeObjectURL(objectUrlMap.get(asset.id)); } catch (_) {}
        objectUrlMap.delete(asset.id);
    }
}

export const TWITCH_CHANNEL_MAP = {
    darkcito: "el_darkcito",
    lbl_oficial: "lbl_esports"
};

export const TWITCH_CLIPS_WORKER_ENDPOINT = "https://lbl-cors-proxy.hill-donkey.workers.dev/twitch/recent-clips";

export function resolveTwitchLoginForOverlayChannel(channelId) {
    const clean = String(channelId || "").toLowerCase().trim();
    if (clean === "lbl_oficial" || clean === "lblesports" || clean === "lbl" || clean.includes("lbl")) {
        return TWITCH_CHANNEL_MAP.lbl_oficial;
    }
    return TWITCH_CHANNEL_MAP.darkcito;
}

export function normalizeClipsConfig(rawConfig) {
    const src = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    const validMix = src.mixMode === "interleaved" ? "interleaved" : "ads_then_clips";
    return {
        enabled: typeof src.enabled === "boolean" ? src.enabled : true,
        windowMinutes: Math.min(Math.max(5, Number(src.windowMinutes) || 40), 10080),
        maxClips: Math.min(Math.max(1, Number(src.maxClips) || 6), 15),
        mixMode: validMix,
        muted: typeof src.muted === "boolean" ? src.muted : true,
        testHistorical: Boolean(src.testHistorical),
        blockedClipIds: Array.isArray(src.blockedClipIds) ? src.blockedClipIds.filter(Boolean) : []
    };
}

export function normalizeMediaSources(dataOrSources) {
    const raw = dataOrSources && typeof dataOrSources === "object" ? dataOrSources : {};
    const mType = raw.mediaType;
    if (mType === "playlist") return { assets: true, codeGallery: false, clips: false };
    if (mType === "clips") return { assets: false, codeGallery: false, clips: true };
    if (mType === "default") return { assets: false, codeGallery: true, clips: false };

    const src = raw.mediaSources && typeof raw.mediaSources === "object"
        ? raw.mediaSources
        : (typeof raw.assets === "boolean" || typeof raw.codeGallery === "boolean" || typeof raw.clips === "boolean" ? raw : null);

    if (src) {
        if (src.assets) return { assets: true, codeGallery: false, clips: false };
        if (src.clips) return { assets: false, codeGallery: false, clips: true };
    }
    return { assets: false, codeGallery: true, clips: false };
}

export function formatClipRelativeAge(createdAtIso) {
    const ts = new Date(createdAtIso || "").getTime();
    if (!Number.isFinite(ts)) return "reciente";
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return "hace <1m";
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
}

export function filterActiveRecentClips(clips, clipsConfig) {
    const cfg = normalizeClipsConfig(clipsConfig);
    if (!cfg.enabled || !Array.isArray(clips)) return [];
    const blocked = new Set(cfg.blockedClipIds);
    const cutoffMs = Date.now() - cfg.windowMinutes * 60 * 1000;
    return clips
        .filter((c) => {
            if (!c || !c.id || blocked.has(c.id)) return false;
            if (cfg.testHistorical) return true;
            const createdMs = new Date(c.createdAt || "").getTime();
            return Number.isFinite(createdMs) && createdMs >= cutoffMs;
        })
        .slice(0, cfg.maxClips);
}

export async function fetchRecentTwitchClips(channelLogin, clipsConfig) {
    const cfg = normalizeClipsConfig(clipsConfig);
    const cleanLogin = String(channelLogin || "").trim().toLowerCase();
    if (!cleanLogin) return { clips: [], error: "Canal Twitch no definido" };

    const isLocalHost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    const baseEndpoint = isLocalHost ? "/api/twitch-recent-clips" : TWITCH_CLIPS_WORKER_ENDPOINT;
    const params = new URLSearchParams({
        channel: cleanLogin,
        minutes: String(cfg.windowMinutes),
        limit: String(Math.max(cfg.maxClips, 10))
    });
    if (cfg.testHistorical) params.set("testHistorical", "1");

    const resp = await fetch(`${baseEndpoint}?${params.toString()}`, { cache: "no-store" });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
    }
    return data;
}

export function buildHybridMediaQueue(orderedAds = [], activeClips = [], mixMode = "ads_then_clips") {
    const adItems = (Array.isArray(orderedAds) ? orderedAds : []).map((asset) =>
        asset?.kind ? asset : { kind: "ad", asset }
    );
    const clipItems = (Array.isArray(activeClips) ? activeClips : []).map((clip) => ({
        kind: "clip",
        clip
    }));

    if (mixMode === "interleaved" && adItems.length > 0 && clipItems.length > 0) {
        const result = [];
        const maxLen = Math.max(adItems.length, clipItems.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < adItems.length) result.push(adItems[i]);
            if (i < clipItems.length) result.push(clipItems[i]);
        }
        return result;
    }

    return [...adItems, ...clipItems];
}

const clipBlobUrlCache = new Map();
const clipBlobInFlight = new Map();
const MAX_CACHED_CLIP_BLOBS = 8;

export function getCachedClipPlayableUrl(clip, { fastFallback = false } = {}) {
    if (!clip || !clip.id) return clip?.mp4FastUrl || clip?.mp4Url || "";
    const cached = clipBlobUrlCache.get(clip.id);
    if (cached?.blobUrl) return cached.blobUrl;
    if (fastFallback && clip.mp4FastUrl) return clip.mp4FastUrl;
    return clip.mp4FastUrl || clip.mp4Url || "";
}

export async function prefetchClipBlobUrl(clip, keepClipId = null) {
    // Priorizar siempre 480p (mp4FastUrl ~3.4 MB vs 10-16 MB en 720p) para carga instantánea en RAM sin cortes
    const targetUrl = clip?.mp4FastUrl || clip?.mp4Url || "";
    if (!clip || !clip.id || !targetUrl) return "";
    const existing = clipBlobUrlCache.get(clip.id);
    if (existing?.blobUrl) return existing.blobUrl;

    if (clipBlobInFlight.has(clip.id)) {
        return clipBlobInFlight.get(clip.id);
    }

    const job = (async () => {
        try {
            const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 25000) : null;
            const resp = await fetch(targetUrl, controller ? { signal: controller.signal } : undefined);
            if (timer) clearTimeout(timer);
            if (!resp.ok) return "";

            const blob = await resp.blob();
            if (!blob || blob.size < 1024) return "";

            while (clipBlobUrlCache.size >= MAX_CACHED_CLIP_BLOBS) {
                const candidateKey = Array.from(clipBlobUrlCache.keys()).find((k) => k !== keepClipId && k !== clip.id);
                if (!candidateKey) break;
                const victim = clipBlobUrlCache.get(candidateKey);
                clipBlobUrlCache.delete(candidateKey);
                if (victim?.blobUrl) {
                    try { URL.revokeObjectURL(victim.blobUrl); } catch (_) {}
                }
            }

            const blobUrl = URL.createObjectURL(blob);
            clipBlobUrlCache.set(clip.id, { blobUrl, createdAt: Date.now() });
            return blobUrl;
        } catch (_) {
            return "";
        } finally {
            clipBlobInFlight.delete(clip.id);
        }
    })();

    clipBlobInFlight.set(clip.id, job);
    return job;
}
