/**
 * pwa-manager.js - Gestor Universal de Estados PWA para LBL Esports
 * 
 * Cumple los 4 estados exactos:
 * 1. Web sin app instalada: Botón "Instalar aplicación" y banner móvil activo.
 * 2. Web con app ya instalada: Botón cambia a "Abrir en la app" y al pulsarlo lanza la app instalada en el móvil.
 * 3. Dentro de la app instalada (Standalone): Se ocultan totalmente el botón y las notificaciones/banners.
 * 4. Detección automática al abrir la web en móvil si ya se tiene instalada.
 */

(function () {
    'use strict';

    if (!window.deferredPrompt) {
        window.deferredPrompt = null;
    }

    // Estado 3: Detectar si se está ejecutando DENTRO de la app instalada (Standalone / WebAPK)
    function isRunningInsideApp() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true || 
               document.referrer.includes('android-app://');
    }

    // Estados 2 y 4: Detectar si la app está instalada en el celular/dispositivo
    async function isAppInstalledOnDevice() {
        try {
            // A. Si está dentro de la app, evidentemente está instalada
            if (isRunningInsideApp()) return true;

            // B. Bandera persistente guardada previamente
            if (localStorage.getItem('lbl_pwa_installed') === 'true') return true;

            // C. API nativa oficial de Chromium/Android
            if ('getInstalledRelatedApps' in navigator) {
                const apps = await navigator.getInstalledRelatedApps();
                if (apps && apps.length > 0) {
                    localStorage.setItem('lbl_pwa_installed', 'true');
                    return true;
                }
            }
        } catch (e) {
            console.warn('[LBL PWA] Error en detección de app:', e);
        }
        return false;
    }

    // Notificación toast flotante
    function mostrarNotificacion(msg) {
        try {
            const toast = document.createElement('div');
            toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[10000] bg-black/95 border border-cyan-500/80 text-cyan-300 px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-2xl backdrop-blur-md transition-all duration-300 opacity-0 -translate-y-4 flex items-center gap-2.5';
            toast.innerHTML = `<i class="fas fa-check-circle text-emerald-400 text-base"></i> <span>${msg}</span>`;
            document.body.appendChild(toast);
            requestAnimationFrame(() => {
                toast.classList.remove('opacity-0', '-translate-y-4');
            });
            setTimeout(() => {
                toast.classList.add('opacity-0', '-translate-y-4');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        } catch (e) {}
    }

    // Acción para abrir la app instalada directamente en el celular
    function abrirEnLaApp() {
        mostrarNotificacion('🚀 Abriendo en la aplicación LBL...');
        try {
            const isAndroid = /Android/i.test(navigator.userAgent);
            if (isAndroid) {
                // Intent oficial de Android: abre la WebAPK/PWA instalada en el sistema
                window.location.href = 'intent://lbl-esports.web.app/#Intent;scheme=https;action=android.intent.action.VIEW;end;';
                return;
            }
            window.open('/', '_blank');
        } catch (e) {
            window.open('/', '_blank');
        }
    }

    // Actualización de la interfaz según el estado
    function actualizarUI(dentroDeLaApp, instaladaEnDispositivo) {
        try {
            const btnContainer = document.getElementById('pwa-install-container');
            const btn = document.getElementById('pwa-install-btn');
            const banner = document.getElementById('mobile-pwa-banner');

            // ESTADO 3: Si está corriendo DENTRO de la app instalada -> OCULTAR TODO
            if (dentroDeLaApp) {
                if (btnContainer) btnContainer.style.display = 'none';
                if (btn) btn.style.display = 'none';
                if (banner) {
                    banner.classList.add('hidden');
                    banner.classList.remove('flex');
                }
                return;
            }

            // ESTADOS 2 y 4: Si está en la web y la app YA ESTÁ INSTALADA en el dispositivo
            if (instaladaEnDispositivo) {
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-external-link-alt text-cyan-400 mr-2"></i> ABRIR EN LA APLICACIÓN';
                    btn.className = 'px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-950/80 via-cyan-950/70 to-blue-950/80 text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] font-black text-xs md:text-sm tracking-wider uppercase transition-all duration-300 transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2';
                    btn.onclick = () => abrirEnLaApp();
                }
                // Ocultar banner flotante de instalación (ya la tiene instalada)
                if (banner) {
                    banner.classList.add('hidden');
                    banner.classList.remove('flex');
                }
                return;
            }

            // ESTADO 1: Si está en la web y NO tiene la app instalada
            if (btn) {
                btn.innerHTML = '<i class="fas fa-download mr-2"></i> INSTALAR APLICACIÓN';
                btn.className = 'px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600/25 via-cyan-500/20 to-blue-600/25 hover:from-blue-600 hover:to-cyan-500 text-cyan-300 hover:text-white border border-cyan-400/40 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] font-black text-xs md:text-sm tracking-wider uppercase transition-all duration-300 transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2';
                btn.onclick = () => window.installPWA();
            }
        } catch (err) {
            console.warn('[LBL PWA] Error al actualizar UI:', err);
        }
    }

    // Banner flotante para móviles (solo para usuarios SIN la app instalada)
    function mostrarBannerMovil() {
        if (isRunningInsideApp()) return;
        isAppInstalledOnDevice().then(instalada => {
            if (instalada) return;
            const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
            const dismissed = sessionStorage.getItem('lbl_pwa_banner_dismissed');
            if (isMobile && !dismissed) {
                const banner = document.getElementById('mobile-pwa-banner');
                if (banner) {
                    banner.classList.remove('hidden');
                    banner.classList.add('flex');
                    requestAnimationFrame(() => {
                        banner.classList.remove('translate-y-20', 'opacity-0');
                        banner.classList.add('translate-y-0', 'opacity-100');
                    });
                }
            }
        });
    }

    window.cerrarMobilePwaBanner = function () {
        sessionStorage.setItem('lbl_pwa_banner_dismissed', 'true');
        const banner = document.getElementById('mobile-pwa-banner');
        if (banner) {
            banner.classList.remove('translate-y-0', 'opacity-100');
            banner.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => {
                banner.classList.add('hidden');
                banner.classList.remove('flex');
            }, 350);
        }
    };

    // Disparar prompt nativo del sistema
    async function dispararPromptNativo() {
        if (!window.deferredPrompt) return false;
        try {
            console.log('[LBL PWA] 🚀 Abriendo diálogo nativo de instalación...');
            const promptEvent = window.deferredPrompt;
            window.deferredPrompt = null;
            promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice && choice.outcome === 'accepted') {
                localStorage.setItem('lbl_pwa_installed', 'true');
                actualizarUI(false, true);
                window.cerrarMobilePwaBanner();
            }
            return true;
        } catch (e) {
            console.warn('[LBL PWA] Error en prompt nativo:', e);
            return false;
        }
    }

    // Eventos nativos del navegador
    window.addEventListener('beforeinstallprompt', (e) => {
        try {
            e.preventDefault();
            window.deferredPrompt = e;
            console.log('[LBL PWA] ✅ Instalador nativo preparado.');
            if (!isRunningInsideApp()) {
                isAppInstalledOnDevice().then(instalada => {
                    actualizarUI(false, instalada);
                    if (!instalada) mostrarBannerMovil();
                });
            }
        } catch (err) {}
    });

    window.addEventListener('appinstalled', () => {
        try {
            window.deferredPrompt = null;
            localStorage.setItem('lbl_pwa_installed', 'true');
            console.log('[LBL PWA] 🎉 App instalada con éxito.');
            actualizarUI(false, true);
            window.cerrarMobilePwaBanner();
            mostrarNotificacion('🎉 ¡LBL Esports se ha instalado con éxito!');
        } catch (err) {}
    });

    // FUNCIÓN PRINCIPAL DE INSTALACIÓN (ESTADO 1)
    window.installPWA = async function () {
        try {
            const yaInstalada = await isAppInstalledOnDevice();
            if (yaInstalada) {
                actualizarUI(false, true);
                abrirEnLaApp();
                return;
            }

            if (window.deferredPrompt) {
                await dispararPromptNativo();
                return;
            }

            // Si aún no está listo el prompt nativo, esperar un breve instante
            const btn = document.getElementById('pwa-install-btn');
            const originalText = btn ? btn.innerHTML : '';
            if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> PREPARANDO...';

            let waited = 0;
            while (!window.deferredPrompt && waited < 2500) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }
            if (btn && originalText) btn.innerHTML = originalText;

            if (window.deferredPrompt) {
                await dispararPromptNativo();
                return;
            }

            // Si tras esperar no hubo prompt nativo en Android/PC, es porque la app ya está instalada
            localStorage.setItem('lbl_pwa_installed', 'true');
            actualizarUI(false, true);
            abrirEnLaApp();
        } catch (err) {
            console.warn('[LBL PWA] Error en installPWA:', err);
        }
    };

    // Inicialización al cargar la página
    async function init() {
        try {
            const inside = isRunningInsideApp();
            const installed = await isAppInstalledOnDevice();
            actualizarUI(inside, installed);
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Service Worker
    if ('serviceWorker' in navigator) {
        try {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                })
                .catch(() => {});
        } catch (e) {}
    }
})();
