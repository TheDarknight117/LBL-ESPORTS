/**
 * pwa-manager.js - Gestor Universal de Instalación PWA para LBL Esports
 * Detecta si la app ya está instalada, cambia el botón a "ABRIR APP LBL"
 * y gestiona la instalación nativa directa con protección try/catch.
 */

(function () {
    'use strict';

    if (!window.deferredPrompt) {
        window.deferredPrompt = null;
    }

    // 1. Verificación completa y asíncrona de si la app ya está instalada
    async function verificarSiEstaInstalada() {
        try {
            // A. Modo Standalone / WebApp activa
            if (window.matchMedia('(display-mode: standalone)').matches || 
                window.navigator.standalone === true || 
                document.referrer.includes('android-app://')) {
                return true;
            }

            // B. Bandera persistente en el dispositivo
            if (localStorage.getItem('lbl_pwa_installed') === 'true') {
                return true;
            }

            // C. API nativa oficial de Chromium en Android / PC
            if ('getInstalledRelatedApps' in navigator) {
                const relatedApps = await navigator.getInstalledRelatedApps();
                if (relatedApps && relatedApps.length > 0) {
                    localStorage.setItem('lbl_pwa_installed', 'true');
                    return true;
                }
            }
        } catch (err) {
            console.warn('[LBL PWA] Error al verificar instalación:', err);
        }
        return false;
    }

    // 2. Notificación flotante elegante
    function mostrarNotificacion(msg, esExito = true) {
        try {
            const toast = document.createElement('div');
            const borde = esExito ? 'border-emerald-500/80 text-emerald-300' : 'border-cyan-500/80 text-cyan-300';
            toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[10000] bg-black/95 border ${borde} px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-2xl backdrop-blur-md transition-all duration-300 opacity-0 -translate-y-4 flex items-center gap-2.5`;
            toast.innerHTML = `<i class="fas ${esExito ? 'fa-check-circle text-emerald-400' : 'fa-info-circle text-cyan-400'} text-base"></i> <span>${msg}</span>`;
            document.body.appendChild(toast);
            requestAnimationFrame(() => {
                toast.classList.remove('opacity-0', '-translate-y-4');
            });
            setTimeout(() => {
                toast.classList.add('opacity-0', '-translate-y-4');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        } catch (e) {}
    }

    // 3. Acción al pulsar cuando la app ya está instalada: Abrir la App
    function abrirAppOIndicar() {
        mostrarNotificacion('✅ ¡La aplicación ya está instalada en tu dispositivo!', true);
        try {
            // Intenta abrir el acceso directo de la PWA
            window.open('/', '_blank');
        } catch (e) {}
    }

    // 4. Actualizar botones de la interfaz
    function actualizarBotonesUI(instalada) {
        try {
            const btn = document.getElementById('pwa-install-btn');
            if (btn) {
                if (instalada) {
                    btn.innerHTML = '<i class="fas fa-external-link-alt text-cyan-400 mr-2"></i> ABRIR APP LBL';
                    btn.className = 'px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-950/80 via-cyan-950/70 to-blue-950/80 text-cyan-300 border border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] font-black text-xs md:text-sm tracking-wider uppercase transition-all duration-300 transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2';
                    btn.onclick = () => abrirAppOIndicar();
                } else {
                    btn.classList.remove('hidden');
                }
            }

            // Si está instalada, ocultar el banner flotante móvil para no molestar
            if (instalada) {
                const banner = document.getElementById('mobile-pwa-banner');
                if (banner) {
                    banner.classList.add('hidden');
                    banner.classList.remove('flex');
                }
            }
        } catch (err) {
            console.warn('[LBL PWA] Error actualizando botones:', err);
        }
    }
    window.lblActualizarUI = async () => {
        const inst = await verificarSiEstaInstalada();
        actualizarBotonesUI(inst);
    };

    // 5. Banner flotante para móviles (solo si NO está instalada)
    function mostrarBanner() {
        verificarSiEstaInstalada().then(instalada => {
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

    // 6. Función para disparar la ventana nativa de instalación de Android / PC
    async function dispararPromptNativo() {
        if (!window.deferredPrompt) return false;
        try {
            console.log('[LBL PWA] 🚀 Abriendo instalador nativo...');
            const promptEvent = window.deferredPrompt;
            window.deferredPrompt = null;
            promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice && choice.outcome === 'accepted') {
                console.log('[LBL PWA] Usuario aceptó la instalación.');
                localStorage.setItem('lbl_pwa_installed', 'true');
                actualizarBotonesUI(true);
                window.cerrarMobilePwaBanner();
            }
            return true;
        } catch (e) {
            console.warn('[LBL PWA] Error al disparar prompt nativo:', e);
            return false;
        }
    }

    // 7. Evento oficial beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        try {
            e.preventDefault();
            window.deferredPrompt = e;
            console.log('[LBL PWA] ✅ Instalador nativo listo.');
            actualizarBotonesUI(false);
            mostrarBanner();
        } catch (err) {
            console.warn('[LBL PWA] Error en beforeinstallprompt:', err);
        }
    });

    window.addEventListener('appinstalled', () => {
        try {
            window.deferredPrompt = null;
            localStorage.setItem('lbl_pwa_installed', 'true');
            console.log('[LBL PWA] 🎉 App instalada.');
            actualizarBotonesUI(true);
            window.cerrarMobilePwaBanner();
            mostrarNotificacion('🎉 ¡LBL Esports se ha instalado con éxito!');
        } catch (err) {}
    });

    // 8. FUNCIÓN PRINCIPAL DE INSTALACIÓN / APERTURA
    window.installPWA = async function () {
        try {
            // A. Si ya está instalada, abrir o notificar directamente
            const yaInstalada = await verificarSiEstaInstalada();
            if (yaInstalada) {
                actualizarBotonesUI(true);
                abrirAppOIndicar();
                return;
            }

            // B. Si el instalador nativo está listo en memoria, abrirlo de inmediato
            if (window.deferredPrompt) {
                await dispararPromptNativo();
                return;
            }

            // C. Si aún no está listo (clic en el primer segundo tras cargar), dar margen de espera
            const btn = document.getElementById('pwa-install-btn');
            const originalText = btn ? btn.innerHTML : '';
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> COMPROBANDO...';
            }

            let waited = 0;
            while (!window.deferredPrompt && waited < 2500) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }

            if (btn && originalText) {
                btn.innerHTML = originalText;
            }

            if (window.deferredPrompt) {
                await dispararPromptNativo();
                return;
            }

            // D. Si tras esperar no hay prompt: en Android/Chrome esto sucede porque
            // la app ya está instalada en el dispositivo móvil. Actualizamos el botón.
            localStorage.setItem('lbl_pwa_installed', 'true');
            actualizarBotonesUI(true);
            abrirAppOIndicar();
        } catch (err) {
            console.warn('[LBL PWA] Error en installPWA:', err);
        }
    };

    // 9. Inicialización inmediata
    async function init() {
        try {
            const instalada = await verificarSiEstaInstalada();
            actualizarBotonesUI(instalada);
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 10. Service Worker
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
