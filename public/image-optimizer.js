/**
 * image-optimizer.js
 * Modulo de Optimizacion y Conversion Adaptativa a WebP para LBL eSports
 * Implementa Nivel 1 (Upload/Edit Converter) y Nivel 2 (Runtime Converter & Cache)
 */

import { mapearLogoAWebp, OFFICIAL_LBL_TEAM_LOGOS } from "/challonge-core.js";

// Cache en memoria para URLs Base64/Blob WebP generadas en tiempo de ejecucion
const runtimeWebpMemoryCache = new Map();

/**
 * NIVEL 1: Convierte un archivo File (PNG/JPG) o DataURL a un WebP optimizado en el cliente.
 * Mantiene transparencia alpha y reduce dimensiones a max 256x256.
 *
 * @param {File|Blob|string} imageSource - Archivo de imagen o dataURL
 * @param {number} maxDimension - Tamano maximo en pixeles (default 256)
 * @param {number} quality - Calidad de compresion WebP (0 a 1, default 0.88)
 * @returns {Promise<string>} - Retorna DataURL base64 en formato image/webp
 */
export async function convertirImagenAWebpBase64(imageSource, maxDimension = 256, quality = 0.88) {
    return new Promise((resolve, reject) => {
        const processImage = (src) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                try {
                    const webpDataUrl = canvas.toDataURL('image/webp', quality);
                    resolve(webpDataUrl);
                } catch (err) {
                    resolve(canvas.toDataURL('image/png'));
                }
            };
            img.onerror = () => resolve(typeof imageSource === 'string' ? imageSource : '');
            img.src = src;
        };

        if (imageSource instanceof File || imageSource instanceof Blob) {
            const reader = new FileReader();
            reader.onload = (e) => processImage(e.target.result);
            reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
            reader.readAsDataURL(imageSource);
        } else if (typeof imageSource === 'string') {
            processImage(imageSource);
        } else {
            resolve('');
        }
    });
}

/**
 * NIVEL 2: Adaptador Runtime Mutable para logos que se cargan desde URLs PNG externas.
 * 1. Revisa si es equipo oficial o ya es .webp -> Retorna inmediato.
 * 2. Si es una URL PNG/JPG remota, la descarga y convierte en Blob WebP local en background.
 *
 * @param {string} url - URL del logo
 * @param {string} nombre - Nombre del equipo
 * @param {string} tag - Tag del equipo
 * @returns {string} - URL optimizada
 */
export function obtenerLogoAdaptativoWebp(url, nombre = '', tag = '') {
    const rawUrl = (url || '').trim();
    const nameStr = (nombre || '').trim();
    const tagStr = (tag || '').trim();

    // 1. Mapeo estatico a assets/teams/*.webp
    const mapped = mapearLogoAWebp(rawUrl, nameStr, tagStr);
    if (mapped && mapped.endsWith('.webp')) {
        return mapped;
    }

    // 2. Si ya es WebP o data:image/webp
    if (rawUrl.toLowerCase().includes('.webp') || rawUrl.startsWith('data:image/webp')) {
        return rawUrl;
    }

    // 3. Si ya se convirtio en esta sesion en memoria
    if (runtimeWebpMemoryCache.has(rawUrl)) {
        return runtimeWebpMemoryCache.get(rawUrl);
    }

    // 4. Si es una imagen PNG o JPG externa
    if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:image/'))) {
        convertirImagenAWebpBase64(rawUrl, 256, 0.88).then(webpResult => {
            if (webpResult && webpResult.startsWith('data:image/webp')) {
                runtimeWebpMemoryCache.set(rawUrl, webpResult);
                document.querySelectorAll(`img[src="${rawUrl}"]`).forEach(el => {
                    el.src = webpResult;
                });
            }
        }).catch(() => {});
    }

    return rawUrl;
}
