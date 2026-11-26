/**
 * presencial-logo-store.js
 * Almacenamiento dual para logos del Torneo Presencial:
 * - WebP ligero (220px) en `equipo.logo` para renderizado ultrarrápido en vitrina y tarjetas.
 * - Archivo original intacto (PNG/JPG/SVG/WebP sin recomprimir) dividido en chunks binarios `Bytes`
 *   en Firestore (`inscripciones_torneos_logos`), descargado bajo demanda por el Staff con caché IndexedDB.
 */

import { doc, getDoc, setDoc, Bytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const LOGO_ORIGINALS_COLLECTION = "inscripciones_torneos_logos";
export const LOGO_CHUNK_SIZE_BYTES = 650 * 1024; // 650 KB (< 1 MB límite por documento Firestore)
export const MAX_ORIGINAL_LOGO_BYTES = 15 * 1024 * 1024; // 15 MB máximo por archivo original

const IDB_NAME = "lbl_presencial_logos_db";
const IDB_VERSION = 1;
const IDB_STORE = "logos";
const DRAFT_LOGO_KEY = "__draft_torneo_lan_logo__";

let idbPromise = null;

function openLogosDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            return reject(new Error("IndexedDB no disponible"));
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

async function idbPutLogoRecord(record) {
    try {
        const db = await openLogosDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            tx.objectStore(IDB_STORE).put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (_) {}
}

async function idbGetLogoRecord(id) {
    try {
        const db = await openLogosDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readonly");
            const req = tx.objectStore(IDB_STORE).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (_) {
        return null;
    }
}

async function idbDeleteLogoRecord(id) {
    try {
        const db = await openLogosDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            tx.objectStore(IDB_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (_) {}
}

export function formatearBytesLogo(bytes) {
    const n = Number(bytes) || 0;
    if (n <= 0) return "0 B";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function obtenerExtensionImagen(fileName = "", mimeType = "") {
    const mimeMap = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/svg+xml": "svg",
        "image/gif": "gif",
        "image/avif": "avif",
        "image/bmp": "bmp",
        "image/x-icon": "ico",
        "image/vnd.microsoft.icon": "ico"
    };
    const normMime = String(mimeType || "").split(";")[0].trim().toLowerCase();
    if (mimeMap[normMime]) return mimeMap[normMime];

    const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]{2,5})(?:\?|#|$)/);
    return match ? match[1] : "png";
}

export function construirNombreDescargaLogo(equipoObj = {}, meta = null, extOverride = "") {
    const tag = String(equipoObj?.tag || "LBL")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "");
    const nombre = String(equipoObj?.nombre || "equipo")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 32);
    const ext = extOverride || obtenerExtensionImagen(meta?.fileName || "", meta?.mimeType || "");
    const prefijo = [tag, nombre].filter(Boolean).join("_") || "logo_equipo";
    return `${prefijo}_original.${ext}`;
}

export async function obtenerDimensionesImagenArchivo(file) {
    return new Promise((resolve) => {
        if (!file) return resolve({ width: 0, height: 0 });
        let url = "";
        try {
            url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const width = Number(img.naturalWidth || img.width || 0);
                const height = Number(img.naturalHeight || img.height || 0);
                try { URL.revokeObjectURL(url); } catch (_) {}
                resolve({ width, height });
            };
            img.onerror = () => {
                try { URL.revokeObjectURL(url); } catch (_) {}
                resolve({ width: 0, height: 0 });
            };
            img.src = url;
        } catch (_) {
            if (url) try { URL.revokeObjectURL(url); } catch (_) {}
            resolve({ width: 0, height: 0 });
        }
    });
}

export async function guardarBorradorLogoOriginalIDB(file) {
    if (!file) return;
    await idbPutLogoRecord({
        id: DRAFT_LOGO_KEY,
        blob: file,
        fileName: file.name || "logo.png",
        mimeType: file.type || "image/png",
        savedAt: Date.now()
    });
}

export async function cargarBorradorLogoOriginalIDB() {
    const rec = await idbGetLogoRecord(DRAFT_LOGO_KEY);
    if (!rec || !rec.blob) return null;
    try {
        return new File([rec.blob], rec.fileName || "logo.png", {
            type: rec.mimeType || rec.blob.type || "image/png"
        });
    } catch (_) {
        return rec.blob;
    }
}

export async function limpiarBorradorLogoOriginalIDB() {
    await idbDeleteLogoRecord(DRAFT_LOGO_KEY);
}

/**
 * Sube el archivo original sin pérdida ni compresión a `inscripciones_torneos_logos` en chunks binarios.
 * Devuelve metadatos ligeros (~180 bytes) para guardar dentro de `equipo.logoOriginalMeta`.
 */
export async function subirLogoOriginalTorneoLan(file, firestoreDb) {
    if (!file || !firestoreDb) return null;
    if (file.size > MAX_ORIGINAL_LOGO_BYTES) {
        throw new Error(`El logo original supera el límite permitido (${formatearBytesLogo(MAX_ORIGINAL_LOGO_BYTES)}).`);
    }

    const mimeType = String(file.type || "").trim() || `image/${obtenerExtensionImagen(file.name, "")}`;
    const fileName = String(file.name || `logo.${obtenerExtensionImagen("", mimeType)}`).trim();
    const extension = obtenerExtensionImagen(fileName, mimeType);
    const dims = await obtenerDimensionesImagenArchivo(file);

    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const chunksCount = Math.max(1, Math.ceil(uint8.byteLength / LOGO_CHUNK_SIZE_BYTES));
    const assetId = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const writes = [];
    for (let i = 0; i < chunksCount; i++) {
        const start = i * LOGO_CHUNK_SIZE_BYTES;
        const end = Math.min(uint8.byteLength, start + LOGO_CHUNK_SIZE_BYTES);
        const slice = uint8.slice(start, end);
        writes.push(
            setDoc(doc(firestoreDb, LOGO_ORIGINALS_COLLECTION, `${assetId}_chunk_${i}`), {
                assetId,
                index: i,
                fileName,
                mimeType,
                bytes: Bytes.fromUint8Array(slice),
                createdAt: Date.now()
            })
        );
    }
    await Promise.all(writes);

    await idbPutLogoRecord({
        id: assetId,
        blob: file,
        fileName,
        mimeType,
        savedAt: Date.now()
    });

    return {
        assetId,
        fileName,
        mimeType,
        extension,
        sizeBytes: uint8.byteLength,
        width: dims.width,
        height: dims.height,
        chunksCount,
        uploadedAt: new Date().toISOString()
    };
}

/**
 * Descarga bajo demanda el Blob original completo desde IndexedDB o Firestore (`inscripciones_torneos_logos`).
 */
export async function descargarBlobLogoOriginalTorneoLan(meta, firestoreDb) {
    if (!meta?.assetId || !firestoreDb) {
        throw new Error("Este equipo no tiene un archivo original adjunto.");
    }

    const cached = await idbGetLogoRecord(meta.assetId);
    if (cached && cached.blob) {
        return {
            blob: cached.blob,
            fileName: meta.fileName || cached.fileName || "logo-original.png",
            mimeType: meta.mimeType || cached.mimeType || cached.blob.type || "image/png"
        };
    }

    const chunksCount = Math.max(1, Number(meta.chunksCount) || 1);
    const snaps = await Promise.all(
        Array.from({ length: chunksCount }, (_, i) =>
            getDoc(doc(firestoreDb, LOGO_ORIGINALS_COLLECTION, `${meta.assetId}_chunk_${i}`))
        )
    );

    const parts = [];
    let totalLen = 0;
    for (let i = 0; i < snaps.length; i++) {
        const snap = snaps[i];
        if (!snap.exists()) {
            throw new Error(`Falta el bloque #${i + 1} del logo original en Firestore.`);
        }
        const bytesField = snap.data()?.bytes;
        const arr = bytesField && typeof bytesField.toUint8Array === "function"
            ? bytesField.toUint8Array()
            : new Uint8Array(bytesField || []);
        parts.push(arr);
        totalLen += arr.byteLength;
    }

    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) {
        combined.set(part, offset);
        offset += part.byteLength;
    }

    const mimeType = meta.mimeType || "image/png";
    const fileName = meta.fileName || `logo-original.${meta.extension || obtenerExtensionImagen("", mimeType)}`;
    const blob = new Blob([combined], { type: mimeType });

    await idbPutLogoRecord({
        id: meta.assetId,
        blob,
        fileName,
        mimeType,
        savedAt: Date.now()
    });

    return { blob, fileName, mimeType };
}

function dispararDescargaBlob(blob, downloadName) {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
        try { URL.revokeObjectURL(objectUrl); } catch (_) {}
    }, 5000);
}

/**
 * Descarga para producción: prioriza el archivo original sin pérdida; si es URL externa intenta bajarla;
 * si es registro previo sin original, descarga la versión WebP existente indicando el fallback.
 */
export async function descargarLogoProduccionEquipo(equipoDoc, firestoreDb) {
    const eqInfo = equipoDoc?.equipo || {};
    const meta = eqInfo.logoOriginalMeta || null;

    if (meta?.assetId && firestoreDb) {
        const { blob, mimeType, fileName } = await descargarBlobLogoOriginalTorneoLan(meta, firestoreDb);
        const ext = obtenerExtensionImagen(fileName, mimeType);
        const downloadName = construirNombreDescargaLogo(eqInfo, meta, ext);
        dispararDescargaBlob(blob, downloadName);
        return { isOriginal: true, downloadName, mimeType, sizeBytes: blob.size, meta };
    }

    const logoSrc = String(eqInfo.logo || "").trim();
    if (/^https?:\/\//i.test(logoSrc)) {
        try {
            const resp = await fetch(logoSrc, { mode: "cors" });
            if (!resp.ok) throw new Error("HTTP error");
            const blob = await resp.blob();
            const ext = obtenerExtensionImagen(logoSrc, blob.type);
            const downloadName = construirNombreDescargaLogo(eqInfo, null, ext);
            dispararDescargaBlob(blob, downloadName);
            return { isOriginal: true, fromUrl: true, downloadName, mimeType: blob.type, sizeBytes: blob.size };
        } catch (_) {
            window.open(logoSrc, "_blank", "noopener,noreferrer");
            return { isOriginal: true, openedExternal: true, downloadName: logoSrc };
        }
    }

    if (logoSrc.startsWith("data:image/")) {
        const resp = await fetch(logoSrc);
        const blob = await resp.blob();
        const ext = obtenerExtensionImagen("", blob.type || "image/webp");
        const downloadName = construirNombreDescargaLogo(eqInfo, null, ext).replace(`_original.${ext}`, `_web.${ext}`);
        dispararDescargaBlob(blob, downloadName);
        return { isOriginal: false, downloadName, mimeType: blob.type, sizeBytes: blob.size };
    }

    throw new Error("No hay ningún logo disponible para descargar en este equipo.");
}
