/**
 * ==============================================================================
 * NÚCLEO TRANSVERSAL DE AUTENTICACIÓN (MODAL LOGIN USUARIO/PASS + GOOGLE) Y CONEXIONES (LBL)
 * ==============================================================================
 * Funcionalidades:
 * 1. Botón "Login" en el navbar que abre un Modal Flotante 100% sólido con:
 *    - Inicio de sesión con Usuario/Correo + Contraseña
 *    - Registro de cuenta con Usuario + Correo + Contraseña
 *    - Inicio de sesión con Google (OAuth Popup/Redirect)
 * 2. Al estar logeado, el botón del navbar muestra el ID registrado y despliega un menú sólido.
 * 3. Sincronización de Conexiones Externas (Riot Games API & Twitch Helix OAuth) hacia /cuenta.
 * 4. Asignación automática de Rol (ADMIN si está en STAFF_DIRECTORY, USER para comunidad).
 */

import { auth, db } from "/firebase-config.js";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    linkWithPopup,
    updateProfile,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { STAFF_DIRECTORY, getStaffNick } from "/staff-config.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const USER_CACHE_KEY = 'lbl_user_profile_cache_v1';

let currentUserProfile = null;
let authInitialized = false;
let loginModalSuccessCallback = null;

try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (cached) {
        currentUserProfile = JSON.parse(cached);
    }
} catch (e) {}

export function esCorreoStaff(email) {
    if (!email) return false;
    const clean = email.toString().trim().toLowerCase();
    return Boolean(STAFF_DIRECTORY[clean]);
}

export function obtenerUsuarioActual() {
    return currentUserProfile;
}

/**
 * Devuelve el identificador principal que se muestra en el botón de sesión y en el Ranking.
 */
export function obtenerIdRegistradoUsuario(profile = currentUserProfile) {
    if (!profile) return '';
    if (profile.riotId && profile.riotId.trim()) return profile.riotId.trim();
    if (profile.customNick && profile.customNick.trim()) return profile.customNick.trim();
    if (profile.staffNick && profile.staffNick.trim()) return profile.staffNick.trim();
    if (profile.displayName && profile.displayName.trim()) return profile.displayName.trim();
    return (profile.email || 'Usuario').split('@')[0];
}

function actualizarEstadoLocalUsuario(profile) {
    currentUserProfile = profile;
    try {
        if (profile) {
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(profile));
            if (profile.rol === 'ADMIN') {
                localStorage.setItem('lbl_staff_logged_in', 'true');
            }
        } else {
            localStorage.removeItem(USER_CACHE_KEY);
            localStorage.removeItem('lbl_staff_logged_in');
        }
    } catch (e) {}

    renderizarWidgetsAuthNavbar();
    actualizarBadgesStaffPagina(profile?.rol === 'ADMIN');

    window.dispatchEvent(new CustomEvent('lbl-auth-changed', {
        detail: profile
    }));
}

function actualizarBadgesStaffPagina(isAdmin) {
    const staffBadge = document.getElementById('staff-badge');
    if (staffBadge) {
        if (isAdmin) {
            staffBadge.classList.remove('hidden');
            staffBadge.classList.add('inline-flex');
        } else {
            staffBadge.classList.add('hidden');
            staffBadge.classList.remove('inline-flex');
        }
    }
    const mobileStaffWrap = document.getElementById('mobile-staff-badge-wrap');
    if (mobileStaffWrap) {
        if (isAdmin) {
            mobileStaffWrap.classList.remove('hidden');
            mobileStaffWrap.classList.add('block');
        } else {
            mobileStaffWrap.classList.add('hidden');
            mobileStaffWrap.classList.remove('block');
        }
    }
    const mobileStaffLink = document.getElementById('mobile-staff-link');
    if (mobileStaffLink) {
        if (isAdmin) {
            mobileStaffLink.classList.remove('hidden');
            mobileStaffLink.classList.add('flex');
        } else {
            mobileStaffLink.classList.add('hidden');
            mobileStaffLink.classList.remove('flex');
        }
    }
}

async function sincronizarPerfilFirestore(firebaseUser) {
    if (!firebaseUser) {
        actualizarEstadoLocalUsuario(null);
        return null;
    }

    const uid = firebaseUser.uid;
    const email = (firebaseUser.email || '').toLowerCase().trim();
    const isStaffDirectory = esCorreoStaff(email);
    const staffNick = isStaffDirectory ? getStaffNick(email) : null;

    let docData = null;
    try {
        const userRef = doc(db, "usuarios_lbl", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            docData = snap.data();
        }
    } catch (err) {}

    const rolFinal = (isStaffDirectory || docData?.rol === 'ADMIN') ? 'ADMIN' : 'USER';

    let localAccountData = null;
    try {
        const savedByUid = localStorage.getItem(`lbl_riotid_${uid}`);
        if (savedByUid) localAccountData = JSON.parse(savedByUid);
    } catch (e) {}

    const riotIdGuardado = docData?.riotId ?? localAccountData?.riotId ?? currentUserProfile?.riotId ?? '';
    const gameNameGuardado = docData?.gameName ?? localAccountData?.gameName ?? currentUserProfile?.gameName ?? '';
    const tagLineGuardado = docData?.tagLine ?? localAccountData?.tagLine ?? currentUserProfile?.tagLine ?? '';
    const customNickGuardado = docData?.customNick ?? localAccountData?.customNick ?? currentUserProfile?.customNick ?? '';
    const connectionsGuardadas = docData?.connections ?? localAccountData?.connections ?? currentUserProfile?.connections ?? {};

    const isGoogleLinked = Boolean(
        firebaseUser.providerData?.some(p => p.providerId === 'google.com') ||
        (email && email.endsWith('@gmail.com') && !email.includes('usuarios.lbl-esports.app'))
    );
    const googleEmail = firebaseUser.providerData?.find(p => p.providerId === 'google.com')?.email || (isGoogleLinked ? email : null);
    const googlePhoto = firebaseUser.providerData?.find(p => p.providerId === 'google.com')?.photoURL || null;

    const profileObj = {
        uid,
        email,
        displayName: firebaseUser.displayName || customNickGuardado || staffNick || email.split('@')[0] || 'Invocador',
        customNick: customNickGuardado || firebaseUser.displayName || '',
        photoURL: docData?.photoURL || firebaseUser.photoURL || googlePhoto || connectionsGuardadas?.riot?.profileIconUrl || connectionsGuardadas?.twitch?.profileImageUrl || '/assets/logo.webp',
        rol: rolFinal,
        staffNick: staffNick || (rolFinal === 'ADMIN' ? (docData?.staffNick || 'Staff LBL') : null),
        riotId: riotIdGuardado,
        gameName: gameNameGuardado,
        tagLine: tagLineGuardado,
        connections: connectionsGuardadas,
        isGoogleLinked,
        googleEmail,
        googlePhoto,
        updatedAt: new Date().toISOString()
    };

    try {
        const userRef = doc(db, "usuarios_lbl", uid);
        await setDoc(userRef, {
            uid: profileObj.uid,
            email: profileObj.email,
            displayName: profileObj.displayName,
            customNick: profileObj.customNick || '',
            customNickLower: (profileObj.customNick || profileObj.displayName || '').toLowerCase(),
            photoURL: profileObj.photoURL,
            rol: profileObj.rol,
            staffNick: profileObj.staffNick || null,
            riotId: profileObj.riotId || '',
            gameName: profileObj.gameName || '',
            tagLine: profileObj.tagLine || '',
            connections: profileObj.connections || {},
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (err) {}

    actualizarEstadoLocalUsuario(profileObj);
    return profileObj;
}

/**
 * Login directo con Google (llamado desde dentro del Modal Flotante o desde botones específicos).
 */
export async function loginConGoogle(options = {}) {
    try {
        mostrarToastAuth("Conectando con Google...", "info");
        const result = await signInWithPopup(auth, googleProvider);
        if (result && result.user) {
            const perfil = await sincronizarPerfilFirestore(result.user);
            cerrarModalLoginFlotante();
            const idMostrado = obtenerIdRegistradoUsuario(perfil);
            mostrarToastAuth(`Sesión iniciada: ${idMostrado}`, "success");
            if (typeof options.onSuccess === 'function') {
                options.onSuccess(perfil);
            }
            if (typeof loginModalSuccessCallback === 'function') {
                const cb = loginModalSuccessCallback;
                loginModalSuccessCallback = null;
                cb(perfil);
            }
            return perfil;
        }
    } catch (error) {
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, googleProvider);
            return null;
        } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            mostrarToastAuth("Inicio de sesión cancelado.", "warning");
        } else {
            mostrarToastAuth("No se pudo iniciar sesión con Google.", "error");
        }
    }
    return null;
}

/**
 * Resuelve un usuario o correo electrónico para login por Usuario + Contraseña.
 */
async function resolverCorreoDesdeUsuarioOEmail(identifier) {
    const clean = (identifier || '').trim();
    if (clean.includes('@')) return clean.toLowerCase();

    try {
        const q = query(collection(db, "usuarios_lbl"), where("customNickLower", "==", clean.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const foundEmail = snap.docs[0].data()?.email;
            if (foundEmail) return foundEmail;
        }
    } catch (e) {}

    // Fallback determinístico si se registró solo con nombre de usuario
    return `${clean.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@usuarios.lbl-esports.app`;
}

/**
 * Modal Flotante de Login / Registro (Usuario y Contraseña o Google).
 */
function asegurarModalLoginDOM() {
    if (document.getElementById('lbl-login-modal-backdrop')) return;

    const modalHTML = `
    <div id="lbl-login-modal-backdrop" onclick="if(event.target === this) window.cerrarModalLoginFlotante()" class="fixed inset-0 z-[10000] hidden items-center justify-center p-4" style="background-color: rgba(2, 5, 12, 0.88);">
        <div class="w-full max-w-md rounded-3xl overflow-hidden relative shadow-2xl" style="background-color: #070c16; border: 1px solid #1e293b; box-shadow: 0 28px 70px rgba(0,0,0,0.96);">
            <div class="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-yellow-400"></div>

            <div class="p-6 sm:p-7 space-y-5">
                <!-- Cabecera -->
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <img src="/assets/logo.webp" onerror="this.src='/assets/logo.png'" alt="LBL" class="w-10 h-10 object-contain">
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-widest text-cyan-400 block">Acceso LBL Esports</span>
                            <h3 id="lbl-login-modal-title" class="text-xl font-black uppercase italic tracking-tight text-white leading-none mt-0.5">
                                INICIAR <span class="text-cyan-400">SESIÓN</span>
                            </h3>
                        </div>
                    </div>
                    <button type="button" onclick="window.cerrarModalLoginFlotante()" class="w-8 h-8 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>

                <!-- Pestañas: Iniciar Sesión / Crear Cuenta -->
                <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl" style="background-color: #03060d; border: 1px solid #1e293b;">
                    <button type="button" id="tab-auth-login" onclick="window.cambiarTabModalAuth('login')" class="py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        Iniciar Sesión
                    </button>
                    <button type="button" id="tab-auth-register" onclick="window.cambiarTabModalAuth('register')" class="py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer text-gray-400 hover:text-white border border-transparent">
                        Crear Cuenta
                    </button>
                </div>

                <!-- Formulario Usuario / Contraseña -->
                <form id="form-lbl-auth-modal" class="space-y-3.5">
                    <!-- Campo extra de Nick solo en Registro -->
                    <div id="wrap-auth-register-nick" class="hidden">
                        <label class="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                            <i class="fas fa-user mr-1 text-cyan-400"></i> Nombre de Usuario (ID Visible)
                        </label>
                        <input type="text" id="input-auth-username" maxlength="20" placeholder="Ej: Darkcito"
                            style="background-color: #03060c; border: 1px solid #1f2937;"
                            class="w-full text-white font-bold text-sm px-3.5 py-2.5 rounded-xl focus:border-cyan-400 focus:outline-none transition-colors">
                    </div>

                    <div>
                        <label id="label-auth-identifier" class="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                            <i class="fas fa-envelope mr-1 text-cyan-400"></i> Usuario o Correo Electrónico
                        </label>
                        <input type="text" id="input-auth-identifier" required placeholder="Tu usuario o correo@ejemplo.com"
                            style="background-color: #03060c; border: 1px solid #1f2937;"
                            class="w-full text-white font-bold text-sm px-3.5 py-2.5 rounded-xl focus:border-cyan-400 focus:outline-none transition-colors">
                    </div>

                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                <i class="fas fa-lock mr-1 text-cyan-400"></i> Contraseña
                            </label>
                            <button type="button" id="btn-auth-forgot-pass" onclick="window.recuperarPasswordModal()" class="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer">
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
                        <input type="password" id="input-auth-password" required minlength="6" placeholder="••••••••"
                            style="background-color: #03060c; border: 1px solid #1f2937;"
                            class="w-full text-white font-bold text-sm px-3.5 py-2.5 rounded-xl focus:border-cyan-400 focus:outline-none transition-colors">
                    </div>

                    <p id="lbl-auth-modal-error" class="hidden text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-500/40 rounded-xl p-2.5 text-center"></p>

                    <button type="submit" id="btn-submit-auth-modal" class="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer active:scale-95">
                        Entrar a mi Cuenta
                    </button>
                </form>

                <!-- Divisor -->
                <div class="relative flex py-1 items-center">
                    <div class="flex-grow border-t border-gray-800"></div>
                    <span class="flex-shrink mx-3 text-[10px] font-black uppercase tracking-widest text-gray-500">O continúa con</span>
                    <div class="flex-grow border-t border-gray-800"></div>
                </div>

                <!-- Botón Google -->
                <button type="button" onclick="window.loginConGoogle()" style="background-color: #040811; border: 1px solid #1e293b;" class="w-full py-3 px-4 rounded-xl hover:border-cyan-400/60 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-md active:scale-95">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-4 h-4">
                    <span>Continuar con Google</span>
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    let currentTab = 'login';

    window.cambiarTabModalAuth = (tab) => {
        currentTab = tab;
        const tabLogin = document.getElementById('tab-auth-login');
        const tabReg = document.getElementById('tab-auth-register');
        const nickWrap = document.getElementById('wrap-auth-register-nick');
        const titleEl = document.getElementById('lbl-login-modal-title');
        const submitBtn = document.getElementById('btn-submit-auth-modal');
        const forgotBtn = document.getElementById('btn-auth-forgot-pass');
        const idLabel = document.getElementById('label-auth-identifier');
        const idInput = document.getElementById('input-auth-identifier');
        const errEl = document.getElementById('lbl-auth-modal-error');

        if (errEl) errEl.classList.add('hidden');

        if (tab === 'register') {
            if (tabReg) tabReg.className = 'py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
            if (tabLogin) tabLogin.className = 'py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer text-gray-400 hover:text-white border border-transparent';
            nickWrap?.classList.remove('hidden');
            forgotBtn?.classList.add('hidden');
            if (titleEl) titleEl.innerHTML = `CREAR <span class="text-cyan-400">CUENTA</span>`;
            if (submitBtn) submitBtn.textContent = 'Registrar Cuenta';
            if (idLabel) idLabel.innerHTML = `<i class="fas fa-envelope mr-1 text-cyan-400"></i> Correo Electrónico`;
            if (idInput) idInput.placeholder = 'tucorreo@ejemplo.com';
        } else {
            if (tabLogin) tabLogin.className = 'py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
            if (tabReg) tabReg.className = 'py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer text-gray-400 hover:text-white border border-transparent';
            nickWrap?.classList.add('hidden');
            forgotBtn?.classList.remove('hidden');
            if (titleEl) titleEl.innerHTML = `INICIAR <span class="text-cyan-400">SESIÓN</span>`;
            if (submitBtn) submitBtn.textContent = 'Entrar a mi Cuenta';
            if (idLabel) idLabel.innerHTML = `<i class="fas fa-user mr-1 text-cyan-400"></i> Usuario o Correo Electrónico`;
            if (idInput) idInput.placeholder = 'Tu usuario o correo@ejemplo.com';
        }
    };

    window.recuperarPasswordModal = async () => {
        const idInput = document.getElementById('input-auth-identifier');
        const errEl = document.getElementById('lbl-auth-modal-error');
        const rawVal = (idInput?.value || '').trim();
        if (!rawVal || !rawVal.includes('@')) {
            if (errEl) {
                errEl.textContent = 'Ingresa tu correo electrónico en el campo superior para enviarte el enlace de recuperación.';
                errEl.classList.remove('hidden');
            }
            return;
        }
        try {
            await sendPasswordResetEmail(auth, rawVal);
            mostrarToastAuth(`Correo de recuperación enviado a ${rawVal}`, 'success');
        } catch (err) {
            if (errEl) {
                errEl.textContent = 'No se pudo enviar el correo de recuperación. Verifica la dirección.';
                errEl.classList.remove('hidden');
            }
        }
    };

    const form = document.getElementById('form-lbl-auth-modal');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('lbl-auth-modal-error');
        const submitBtn = document.getElementById('btn-submit-auth-modal');
        const nickVal = (document.getElementById('input-auth-username')?.value || '').trim();
        const idVal = (document.getElementById('input-auth-identifier')?.value || '').trim();
        const passVal = document.getElementById('input-auth-password')?.value || '';

        if (errEl) errEl.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-1.5"></i> Procesando...`;
        }

        try {
            if (currentTab === 'register') {
                if (!nickVal || nickVal.length < 3) {
                    throw new Error('Ingresa un Nombre de Usuario de al menos 3 caracteres.');
                }
                const emailToCreate = await resolverCorreoDesdeUsuarioOEmail(idVal);
                const cred = await createUserWithEmailAndPassword(auth, emailToCreate, passVal);
                if (cred.user) {
                    await updateProfile(cred.user, { displayName: nickVal });
                    try {
                        localStorage.setItem(`lbl_riotid_${cred.user.uid}`, JSON.stringify({
                            customNick: nickVal,
                            riotId: '',
                            gameName: '',
                            tagLine: ''
                        }));
                    } catch (e2) {}
                    const perfil = await sincronizarPerfilFirestore(cred.user);
                    cerrarModalLoginFlotante();
                    mostrarToastAuth(`¡Cuenta creada! Bienvenido, ${obtenerIdRegistradoUsuario(perfil)}`, 'success');
                    if (typeof loginModalSuccessCallback === 'function') {
                        const cb = loginModalSuccessCallback;
                        loginModalSuccessCallback = null;
                        cb(perfil);
                    }
                }
            } else {
                const emailToLogin = await resolverCorreoDesdeUsuarioOEmail(idVal);
                const cred = await signInWithEmailAndPassword(auth, emailToLogin, passVal);
                if (cred.user) {
                    const perfil = await sincronizarPerfilFirestore(cred.user);
                    cerrarModalLoginFlotante();
                    mostrarToastAuth(`Sesión iniciada: ${obtenerIdRegistradoUsuario(perfil)}`, 'success');
                    if (typeof loginModalSuccessCallback === 'function') {
                        const cb = loginModalSuccessCallback;
                        loginModalSuccessCallback = null;
                        cb(perfil);
                    }
                }
            }
        } catch (error) {
            let msg = error.message || 'Error al autenticar.';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                msg = 'Usuario o contraseña incorrectos.';
            } else if (error.code === 'auth/email-already-in-use') {
                msg = 'Este correo o usuario ya está registrado. Usa "Iniciar Sesión".';
            } else if (error.code === 'auth/weak-password') {
                msg = 'La contraseña debe tener al menos 6 caracteres.';
            } else if (error.code === 'auth/invalid-email') {
                msg = 'Formato de correo inválido.';
            }
            if (errEl) {
                errEl.textContent = msg;
                errEl.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = currentTab === 'register' ? 'Registrar Cuenta' : 'Entrar a mi Cuenta';
            }
        }
    });
}

export function abrirModalLoginFlotante(options = {}) {
    asegurarModalLoginDOM();
    loginModalSuccessCallback = options.onSuccess || null;
    const backdrop = document.getElementById('lbl-login-modal-backdrop');
    const errEl = document.getElementById('lbl-auth-modal-error');
    if (errEl) errEl.classList.add('hidden');
    if (backdrop) {
        backdrop.classList.remove('hidden');
        backdrop.classList.add('flex');
    }
}

export function cerrarModalLoginFlotante() {
    const backdrop = document.getElementById('lbl-login-modal-backdrop');
    if (backdrop) {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('flex');
    }
}

export async function cerrarSesionGlobal() {
    try {
        await signOut(auth);
        actualizarEstadoLocalUsuario(null);
        cerrarMenuPerfilDropdown();
        mostrarToastAuth("Sesión cerrada.", "info");
    } catch (error) {
        console.error("[LBL Auth] Error al cerrar sesión:", error);
    }
}

/**
 * Guarda cambios de perfil y conexiones (Riot Games API & Twitch OAuth) en /cuenta.
 */
export async function guardarDatosMiCuenta(customNickInput, gameNameInput, tagLineInput, extraConnections = null) {
    if (!currentUserProfile || !currentUserProfile.uid) {
        mostrarToastAuth("Debes iniciar sesión primero.", "error");
        return false;
    }

    const cleanCustomNick = (customNickInput || '').toString().trim();
    const rawName = (gameNameInput || '').toString().trim();
    const rawTag = (tagLineInput || '').toString().trim().replace(/^#+/, '').toUpperCase();

    let riotIdCompleto = '';
    if (rawName && rawTag) {
        riotIdCompleto = `${rawName}#${rawTag}`;
    }

    const uid = currentUserProfile.uid;
    const mergedConnections = {
        ...(currentUserProfile.connections || {}),
        ...(extraConnections || {})
    };

    if (!riotIdCompleto && extraConnections && extraConnections.riot === null) {
        delete mergedConnections.riot;
    }
    if (extraConnections && extraConnections.twitch === null) {
        delete mergedConnections.twitch;
    }

    try {
        localStorage.setItem(`lbl_riotid_${uid}`, JSON.stringify({
            customNick: cleanCustomNick,
            riotId: riotIdCompleto,
            gameName: riotIdCompleto ? rawName : '',
            tagLine: riotIdCompleto ? rawTag : '',
            connections: mergedConnections
        }));
    } catch (e) {}

    const updatedProfile = {
        ...currentUserProfile,
        customNick: cleanCustomNick,
        riotId: riotIdCompleto,
        gameName: riotIdCompleto ? rawName : '',
        tagLine: riotIdCompleto ? rawTag : '',
        connections: mergedConnections
    };

    const nuevoIdRegistrado = obtenerIdRegistradoUsuario(updatedProfile);

    try {
        const userRef = doc(db, "usuarios_lbl", uid);
        await setDoc(userRef, {
            customNick: cleanCustomNick,
            customNickLower: cleanCustomNick.toLowerCase(),
            riotId: riotIdCompleto,
            gameName: riotIdCompleto ? rawName : '',
            tagLine: riotIdCompleto ? rawTag : '',
            connections: mergedConnections,
            updatedAt: serverTimestamp()
        }, { merge: true });

        const pickemRef = doc(db, "pickems_scouting3", uid);
        const pickemSnap = await getDoc(pickemRef);
        if (pickemSnap.exists()) {
            await updateDoc(pickemRef, {
                riotId: nuevoIdRegistrado,
                gameName: riotIdCompleto ? rawName : nuevoIdRegistrado,
                tagLine: riotIdCompleto ? rawTag : 'LBL',
                photoURL: updatedProfile.photoURL || '',
                rol: updatedProfile.rol || 'USER',
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {}

    actualizarEstadoLocalUsuario(updatedProfile);
    mostrarToastAuth(`Cuenta actualizada: ${nuevoIdRegistrado}`, "success");
    return true;
}

/**
 * Vincula la cuenta de Google al usuario autenticado actual (mediante linkWithPopup).
 */
export async function vincularCuentaGoogleActual() {
    if (!auth.currentUser) {
        mostrarToastAuth("Debes iniciar sesión primero.", "error");
        return null;
    }
    try {
        mostrarToastAuth("Conectando con Google...", "info");
        const res = await linkWithPopup(auth.currentUser, googleProvider);
        if (res && res.user) {
            const perfil = await sincronizarPerfilFirestore(res.user);
            mostrarToastAuth("¡Cuenta de Google vinculada con éxito!", "success");
            return perfil;
        }
    } catch (error) {
        if (error.code === 'auth/credential-already-in-use') {
            mostrarToastAuth("Esta cuenta de Google ya está vinculada a otro usuario.", "error");
        } else if (error.code === 'auth/provider-already-linked') {
            mostrarToastAuth("Esta cuenta ya está vinculada con Google.", "info");
        } else if (error.code === 'auth/popup-closed-by-user') {
            mostrarToastAuth("Vinculación cancelada.", "warning");
        } else {
            mostrarToastAuth("Error al vincular con Google: " + (error.message || ''), "error");
        }
    }
    return null;
}

/**
 * Actualiza el icono/foto de perfil elegido por el usuario (en Firebase Auth, Firestore y localStorage).
 */
export async function actualizarFotoPerfilUsuario(newPhotoURL) {
    if (!currentUserProfile || !currentUserProfile.uid) {
        mostrarToastAuth("Debes iniciar sesión primero.", "error");
        return false;
    }
    const cleanUrl = (newPhotoURL || '').trim();
    if (!cleanUrl) return false;

    const uid = currentUserProfile.uid;
    const updatedProfile = {
        ...currentUserProfile,
        photoURL: cleanUrl
    };

    actualizarEstadoLocalUsuario(updatedProfile);

    try {
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, { photoURL: cleanUrl });
        }
        const userRef = doc(db, "usuarios_lbl", uid);
        await setDoc(userRef, {
            photoURL: cleanUrl,
            updatedAt: serverTimestamp()
        }, { merge: true });

        const pickemRef = doc(db, "pickems_scouting3", uid);
        const pSnap = await getDoc(pickemRef);
        if (pSnap.exists()) {
            await updateDoc(pickemRef, {
                photoURL: cleanUrl,
                updatedAt: serverTimestamp()
            });
        }
    } catch (e) {}

    mostrarToastAuth("¡Icono de perfil actualizado!", "success");
    return true;
}

export function abrirModalRiotId() {
    cerrarMenuPerfilDropdown();
    window.location.href = '/cuenta';
}

export function cerrarModalRiotId() {
    cerrarModalLoginFlotante();
}

export async function desvincularRiotIdUsuario() {
    const u = obtenerUsuarioActual();
    if (!u) return;
    await guardarDatosMiCuenta(u.customNick || u.displayName || '', '', '', { riot: null });
}

export function mostrarToastAuth(mensaje, tipo = 'info') {
    let container = document.getElementById('lbl-auth-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'lbl-auth-toast-container';
        container.className = 'fixed bottom-5 right-5 z-[10050] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0';
        document.body.appendChild(container);
    }

    const colores = {
        success: 'border-emerald-500/50 text-emerald-300',
        error: 'border-rose-500/50 text-rose-300',
        warning: 'border-amber-500/50 text-amber-300',
        info: 'border-cyan-500/50 text-cyan-300'
    };
    const iconos = {
        success: 'fa-check-circle text-emerald-400',
        error: 'fa-exclamation-triangle text-rose-400',
        warning: 'fa-info-circle text-amber-400',
        info: 'fa-bolt text-cyan-400'
    };

    const toast = document.createElement('div');
    toast.style.backgroundColor = '#060b14';
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-bold transition-all duration-300 transform translate-y-2 opacity-0 ${colores[tipo] || colores.info}`;
    toast.innerHTML = `
        <i class="fas ${iconos[tipo] || iconos.info} text-sm shrink-0"></i>
        <span class="leading-snug">${escapeHtml(mensaje)}</span>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3400);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function cerrarMenuPerfilDropdown() {
    const menu = document.getElementById('lbl-user-dropdown-menu');
    if (menu) {
        menu.classList.add('hidden');
    }
}

window.toggleMenuPerfilDropdown = (e) => {
    if (e) e.stopPropagation();
    const menu = document.getElementById('lbl-user-dropdown-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
};

document.addEventListener('click', (e) => {
    const wrap = document.getElementById('lbl-auth-nav-desktop');
    const menu = document.getElementById('lbl-user-dropdown-menu');
    if (menu && !menu.classList.contains('hidden')) {
        if (wrap && !wrap.contains(e.target)) {
            menu.classList.add('hidden');
        }
    }
});

/**
 * Renderiza el botón "Login" (abre el modal flotante con Usuario/Contraseña o Google)
 * y cuando está logeado muestra el ID registrado con el menú desplegable 100% opaco.
 */
export function renderizarWidgetsAuthNavbar() {
    const desktopContainer = document.getElementById('lbl-auth-nav-desktop');
    const mobileContainer = document.getElementById('lbl-auth-nav-mobile');

    if (!currentUserProfile) {
        if (desktopContainer) {
            desktopContainer.innerHTML = `
                <button onclick="window.abrirModalLoginFlotante()" style="background-color:#0b1324; border:1px solid rgba(56,189,248,0.4);" class="px-4 py-2 rounded-xl hover:border-cyan-400 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95">
                    <i class="fas fa-sign-in-alt text-cyan-400 text-xs"></i>
                    <span>Login</span>
                </button>
            `;
        }
        if (mobileContainer) {
            mobileContainer.innerHTML = `
                <button onclick="window.abrirModalLoginFlotante()" style="background-color:#0b1324; border:1px solid rgba(56,189,248,0.4);" class="w-full p-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer shadow-md">
                    <i class="fas fa-sign-in-alt text-cyan-400"></i>
                    <span>Login</span>
                </button>
            `;
        }
        return;
    }

    const isAdmin = currentUserProfile.rol === 'ADMIN';
    const registeredId = escapeHtml(obtenerIdRegistradoUsuario(currentUserProfile));
    const avatarUrl = currentUserProfile.connections?.riot?.profileIconUrl
        || currentUserProfile.photoURL
        || currentUserProfile.connections?.twitch?.profileImageUrl
        || '/assets/logo.webp';

    const roleBadgeHtml = isAdmin
        ? `<span class="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/50 text-red-300 text-[9px] font-black uppercase tracking-wider">ADMIN</span>`
        : `<span class="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[9px] font-black uppercase tracking-wider">USER</span>`;

    if (desktopContainer) {
        desktopContainer.innerHTML = `
            <div class="relative" style="z-index: 9999;">
                <button onclick="window.toggleMenuPerfilDropdown(event)" style="background-color: #080f1d;" class="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border ${isAdmin ? 'border-red-500/45' : 'border-cyan-500/35'} hover:border-cyan-400 transition-all cursor-pointer shadow-md">
                    <img src="${escapeHtml(avatarUrl)}" alt="Avatar" referrerpolicy="no-referrer" onerror="this.src='/assets/logo.webp'" class="w-6 h-6 rounded-lg object-cover border border-white/15">
                    <span class="text-xs font-black text-white tracking-tight max-w-[150px] truncate">${registeredId}</span>
                    <i class="fas fa-chevron-down text-[9px] text-gray-400"></i>
                </button>

                <!-- Menú Desplegable 100% Sólido (Cero Transparencia) -->
                <div id="lbl-user-dropdown-menu" class="hidden absolute right-0 mt-2 w-64 rounded-2xl p-2.5" style="background-color: #070c16 !important; opacity: 1 !important; border: 1px solid #1e293b !important; box-shadow: 0 24px 60px rgba(0,0,0,0.98) !important; z-index: 99999 !important;">
                    <div class="px-3 py-2.5 border-b border-gray-800 mb-1.5 rounded-xl" style="background-color: #040810;">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Cuenta Activa</span>
                            ${roleBadgeHtml}
                        </div>
                        <p class="text-xs font-black text-white truncate mt-1">${registeredId}</p>
                        <p class="text-[10px] text-gray-400 truncate">${escapeHtml(currentUserProfile.email)}</p>
                    </div>

                    <a href="/cuenta" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-200 hover:text-cyan-300 hover:bg-gray-800/80 transition-colors text-left">
                        <i class="fas fa-user-cog text-cyan-400 w-4 text-center"></i>
                        <span>Mi Cuenta / Conexiones</span>
                    </a>

                    <a href="/pickem" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-yellow-300 hover:bg-gray-800/80 transition-colors">
                        <i class="fas fa-trophy text-yellow-400 w-4 text-center"></i>
                        <span>Pick'em Copa Legion</span>
                    </a>

                    ${isAdmin ? `
                        <div class="my-1.5 border-t border-gray-800 pt-1.5">
                            <span class="px-3 text-[9px] font-black uppercase tracking-widest text-red-400 block mb-1">Accesos Staff (ADMIN)</span>
                            <a href="/dashboard" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-300 hover:bg-gray-800/80 transition-colors">
                                <i class="fas fa-user-shield text-red-400 w-4 text-center"></i>
                                <span>Panel de Staff (Dashboard)</span>
                            </a>
                            <a href="/staff-scouting" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-300 hover:bg-gray-800/80 transition-colors">
                                <i class="fas fa-binoculars text-purple-400 w-4 text-center"></i>
                                <span>Staff Scouting 3</span>
                            </a>
                        </div>
                    ` : ''}

                    <div class="mt-1.5 pt-1.5 border-t border-gray-800">
                        <button onclick="window.cerrarSesionGlobal()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-gray-800/80 transition-colors cursor-pointer text-left">
                            <i class="fas fa-sign-out-alt w-4 text-center"></i>
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    if (mobileContainer) {
        mobileContainer.innerHTML = `
            <div class="p-3.5 rounded-2xl space-y-2.5" style="background-color: #070c16; border: 1px solid #1e293b;">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <img src="${escapeHtml(avatarUrl)}" alt="Avatar" referrerpolicy="no-referrer" onerror="this.src='/assets/logo.webp'" class="w-8 h-8 rounded-xl object-cover border border-white/15 shrink-0">
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-black text-white truncate">${registeredId}</span>
                                ${roleBadgeHtml}
                            </div>
                            <span class="text-[10px] text-gray-400 block truncate">${escapeHtml(currentUserProfile.email)}</span>
                        </div>
                    </div>
                    <a href="/cuenta" class="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase shrink-0">
                        <i class="fas fa-user-cog mr-1"></i> Mi Cuenta
                    </a>
                </div>
                <div class="flex items-center gap-2 pt-1 border-t border-gray-800">
                    <a href="/pickem" class="flex-1 py-2 px-3 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-[11px] font-black uppercase text-center">
                        <i class="fas fa-bullseye mr-1"></i> Pick'em
                    </a>
                    ${isAdmin ? `
                        <a href="/dashboard" class="py-2 px-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-black uppercase text-center">
                            <i class="fas fa-shield-alt mr-1"></i> Staff
                        </a>
                    ` : ''}
                    <button onclick="window.cerrarSesionGlobal()" class="py-2 px-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-black uppercase cursor-pointer">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }
}

export function initGlobalAuthUI() {
    if (authInitialized) {
        renderizarWidgetsAuthNavbar();
        return;
    }
    authInitialized = true;

    renderizarWidgetsAuthNavbar();

    getRedirectResult(auth).then((result) => {
        if (result && result.user) {
            sincronizarPerfilFirestore(result.user);
        }
    }).catch(() => {});

    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            await sincronizarPerfilFirestore(firebaseUser);
        } else {
            actualizarEstadoLocalUsuario(null);
        }
    });
}

if (typeof window !== 'undefined') {
    window.loginConGoogle = loginConGoogle;
    window.abrirModalLoginFlotante = abrirModalLoginFlotante;
    window.cerrarModalLoginFlotante = cerrarModalLoginFlotante;
    window.cerrarSesionGlobal = cerrarSesionGlobal;
    window.abrirModalRiotId = abrirModalRiotId;
    window.cerrarModalRiotId = cerrarModalRiotId;
    window.desvincularRiotIdUsuario = desvincularRiotIdUsuario;
    window.vincularCuentaGoogleActual = vincularCuentaGoogleActual;
    window.actualizarFotoPerfilUsuario = actualizarFotoPerfilUsuario;
    window.obtenerUsuarioActual = obtenerUsuarioActual;
    window.obtenerIdRegistradoUsuario = obtenerIdRegistradoUsuario;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalAuthUI);
} else {
    initGlobalAuthUI();
}
