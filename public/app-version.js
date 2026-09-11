/**
 * app-version.js
 * Sistema de Control de Versión y Auto-Purga de Caché para LBL eSports.
 * Permite que cualquier navegador (móvil, PC o PWA) detecte actualizaciones en producción
 * y limpie automáticamente CacheStorage y localStorage sin requerir que el usuario borre datos de navegación.
 */

export const APP_BUILD_VERSION = 'lbl-v2026.09.10-141';

export function inicializarControlDeVersiones() {
    try {
        const versionGuardada = localStorage.getItem('lbl_app_build_version');
        if (versionGuardada && versionGuardada !== APP_BUILD_VERSION) {
            console.log(`[LBL Version Control] 🔄 Nueva versión detectada: ${APP_BUILD_VERSION} (anterior: ${versionGuardada}). Purgando cachés antiguas...`);
            
            // 1. Limpiar datos viejos de equipos y torneos de localStorage
            localStorage.removeItem('lbl_equipos_aceptados_cache');
            localStorage.removeItem('lbl_torneos_cache');
            localStorage.removeItem('lbl_torneo_seleccionado');
            localStorage.removeItem('lbl_torneos_data_fingerprint');

            // 2. Purgar CacheStorage del navegador (todos los buckets de Service Worker)
            if ('caches' in window) {
                caches.keys().then(keys => {
                    return Promise.all(keys.map(k => caches.delete(k)));
                }).catch(() => {});
            }

            // 3. Guardar la nueva versión activa
            localStorage.setItem('lbl_app_build_version', APP_BUILD_VERSION);

            // 4. Forzar actualización del Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => {
                        r.update();
                        if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
                    });
                }).catch(() => {});
            }

            // 5. Recargar una sola vez para aplicar la versión fresca sin bloqueos
            const yaRecargado = sessionStorage.getItem('lbl_version_reloaded');
            if (!yaRecargado) {
                sessionStorage.setItem('lbl_version_reloaded', 'true');
                window.location.reload();
                return true;
            }
        } else if (!versionGuardada) {
            localStorage.setItem('lbl_app_build_version', APP_BUILD_VERSION);
        }
        sessionStorage.removeItem('lbl_version_reloaded');
    } catch (e) {
        console.warn('[LBL Version Control] Error:', e);
    }
    return false;
}

// Ejecución inmediata al importar en cualquier página
inicializarControlDeVersiones();
