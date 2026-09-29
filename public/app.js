import { db } from "/firebase-config.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentStep = 1;
const STORAGE_KEY = 'lbl_registro_data_v4';

const saveToLocal = () => {
    const formData = {};
    document.querySelectorAll('input, select').forEach(input => {
        if (input.id && input.type !== 'radio') formData[input.id] = input.value;
    });
    const capitan = document.querySelector('input[name="capitan"]:checked');
    if (capitan) formData['capitanSeleccionado'] = capitan.value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
};

const loadFromLocal = () => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return;
    try {
        const formData = JSON.parse(savedData);
        Object.keys(formData).forEach(key => {
            const input = document.getElementById(key);
            if (input && key !== 'capitanSeleccionado') {
                input.value = formData[key];
                if(key.includes('_rol') || key.includes('Dep')) input.dispatchEvent(new Event('change', { bubbles: true }));
                else input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        if (formData['capitanSeleccionado']) {
            const radio = document.querySelector(`input[name="capitan"][value="${formData['capitanSeleccionado']}"]`);
            if (radio) radio.checked = true;
        }
    } catch (e) { localStorage.removeItem(STORAGE_KEY); }
    initTeamNameHandler();
};

// Notificación flotante visual para validaciones en registro
export function mostrarAvisoRegistro(msg, tipo = 'error') {
    let toast = document.getElementById('registro-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'registro-toast';
        document.body.appendChild(toast);
    }
    const colorClasses = tipo === 'error'
        ? 'bg-black/95 border-red-500/80 text-red-300 shadow-red-950/40'
        : 'bg-black/95 border-blue-500/80 text-blue-300 shadow-blue-950/40';
    const icon = tipo === 'error'
        ? '<i class="fas fa-circle-exclamation text-red-400 text-base flex-shrink-0"></i>'
        : '<i class="fas fa-info-circle text-blue-400 text-base flex-shrink-0"></i>';

    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[10000] px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black shadow-2xl backdrop-blur-md transition-all duration-300 pointer-events-none flex items-center gap-2.5 max-w-[92vw] border text-center ${colorClasses} opacity-0 -translate-y-4`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;

    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', '-translate-y-4');
    });

    clearTimeout(window._registroToastTimer);
    window._registroToastTimer = setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-4');
    }, 4000);
}

// Opción A: Autocorrección de primera letra a mayúscula y sincronización de contador (máx 35)
const initTeamNameHandler = () => {
    const teamNameInput = document.getElementById('teamName');
    const charCountEl = document.getElementById('teamName-charcount');
    if (!teamNameInput) return;

    const syncTeamName = () => {
        let val = teamNameInput.value;
        if (val.length > 0) {
            const firstChar = val.charAt(0);
            const upperFirst = firstChar.toUpperCase();
            if (firstChar !== upperFirst) {
                const start = teamNameInput.selectionStart;
                const end = teamNameInput.selectionEnd;
                teamNameInput.value = upperFirst + val.slice(1);
                if (start !== null && end !== null) {
                    teamNameInput.setSelectionRange(start, end);
                }
            }
        }
        if (charCountEl) {
            charCountEl.textContent = `${teamNameInput.value.length}/35`;
            if (teamNameInput.value.length >= 35) {
                charCountEl.classList.add('text-amber-400');
                charCountEl.classList.remove('text-gray-500');
            } else {
                charCountEl.classList.remove('text-amber-400');
                charCountEl.classList.add('text-gray-500');
            }
        }
    };

    teamNameInput.addEventListener('input', syncTeamName);
    teamNameInput.addEventListener('blur', () => {
        if (teamNameInput.value.length > 0) {
            const trimmed = teamNameInput.value.trim();
            teamNameInput.value = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        }
        syncTeamName();
    });

    syncTeamName();
};

document.addEventListener('input', saveToLocal);
document.addEventListener('change', saveToLocal);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFromLocal);
} else {
    loadFromLocal();
}

document.addEventListener('input', (e) => {
    if (e.target.classList.contains('border-red-500')) e.target.classList.remove('border-red-500', 'bg-red-900/10');
    if (e.target.id && e.target.id.includes('_riot')) {
        const isSecundario = e.target.id.endsWith('2');
        const prefix = e.target.id.split('_')[0];
        const opggInput = document.getElementById(isSecundario ? `${prefix}_opgg2` : `${prefix}_opgg`);
        const region = isSecundario ? document.getElementById(`${prefix}_region2`).value : 'las';
        if (opggInput) {
            const riotId = e.target.value.trim();
            if (riotId.includes('#')) {
                opggInput.value = `https://www.op.gg/summoners/${region}/${riotId.replace('#', '-').replace(/\s+/g, '%20')}`;
                opggInput.classList.add('text-blue-300', 'font-bold');
            } else {
                opggInput.value = '';
                opggInput.classList.remove('text-blue-300', 'font-bold');
            }
        }
    }
});

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('border-red-500')) e.target.classList.remove('border-red-500', 'bg-red-900/10');
    if (e.target.id && e.target.id.endsWith('_region2')) {
        const riotInput = document.getElementById(`${e.target.id.split('_')[0]}_riot2`);
        if (riotInput.value) riotInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
});

window.validarPasoActual = (step) => {
    let esValido = true;
    let primerError = null;
    let hayVacios = false;
    let hayFormatoInvalido = false;

    const stepEl = document.getElementById(`step-${step}`);
    if (!stepEl) return true;

    // 1. Validar campos con atributo required
    stepEl.querySelectorAll('input[required], select[required]').forEach(campo => {
        const val = campo.value.trim();
        if (!val) {
            esValido = false;
            hayVacios = true;
            campo.classList.add('border-red-500', 'bg-red-900/10', 'animate-pulse');
            setTimeout(() => campo.classList.remove('animate-pulse'), 500);
            if (!primerError) primerError = campo;
        } else if ((campo.type === 'email' || campo.type === 'url') && !campo.checkValidity()) {
            esValido = false;
            hayFormatoInvalido = true;
            campo.classList.add('border-red-500', 'bg-red-900/10');
            if (!primerError) primerError = campo;
        }
    });

    // 2. Validar formato en campos opcionales que contengan texto (urls / emails)
    stepEl.querySelectorAll('input:not([required])').forEach(campo => {
        if ((campo.type === 'email' || campo.type === 'url') && campo.value.trim() && !campo.checkValidity()) {
            esValido = false;
            hayFormatoInvalido = true;
            campo.classList.add('border-red-500', 'bg-red-900/10');
            if (!primerError) primerError = campo;
        }
    });

    // 3. Validación especial en paso 2: Representantes legales
    if (step === 2) {
        const rep1Nom = document.getElementById('rep1Nombre');
        const rep1CI = document.getElementById('rep1CI');
        const rep1Mail = document.getElementById('rep1Mail');
        const rep1Tel = document.getElementById('rep1Tel');

        const rep2Nom = document.getElementById('rep2Nombre');
        const rep2CI = document.getElementById('rep2CI');
        const rep2Mail = document.getElementById('rep2Mail');
        const rep2Tel = document.getElementById('rep2Tel');
        const rep2Dep = document.getElementById('rep2Dep');
        const rep2DepOtro = document.getElementById('rep2DepOtro');

        if (rep2Nom && rep2CI && rep2Mail && rep2Tel) {
            const r2LlenoAlgo = rep2Nom.value.trim() || rep2CI.value.trim() || rep2Mail.value.trim() || rep2Tel.value.trim() || (rep2Dep && rep2Dep.value.trim());

            if (r2LlenoAlgo) {
                // Comprobar si son la misma persona que Responsable #1
                let hayDuplicado = false;
                let detalleDuplicado = '';

                if (rep1CI.value.trim() && rep2CI.value.trim() && rep1CI.value.trim() === rep2CI.value.trim()) {
                    rep2CI.classList.add('border-red-500', 'bg-red-900/10');
                    if (!primerError) primerError = rep2CI;
                    hayDuplicado = true;
                    detalleDuplicado = 'C.I. duplicado';
                }
                if (rep1Mail.value.trim() && rep2Mail.value.trim() && rep1Mail.value.trim().toLowerCase() === rep2Mail.value.trim().toLowerCase()) {
                    rep2Mail.classList.add('border-red-500', 'bg-red-900/10');
                    if (!primerError) primerError = rep2Mail;
                    hayDuplicado = true;
                    detalleDuplicado = detalleDuplicado ? `${detalleDuplicado}, correo duplicado` : 'correo duplicado';
                }
                if (rep1Tel.value.trim() && rep2Tel.value.trim() && rep1Tel.value.trim() === rep2Tel.value.trim()) {
                    rep2Tel.classList.add('border-red-500', 'bg-red-900/10');
                    if (!primerError) primerError = rep2Tel;
                    hayDuplicado = true;
                    detalleDuplicado = detalleDuplicado ? `${detalleDuplicado}, WhatsApp duplicado` : 'WhatsApp duplicado';
                }
                if (rep1Nom.value.trim() && rep2Nom.value.trim() && rep1Nom.value.trim().toLowerCase() === rep2Nom.value.trim().toLowerCase()) {
                    rep2Nom.classList.add('border-red-500', 'bg-red-900/10');
                    if (!primerError) primerError = rep2Nom;
                    hayDuplicado = true;
                    detalleDuplicado = detalleDuplicado ? `${detalleDuplicado}, nombre duplicado` : 'nombre duplicado';
                }

                if (hayDuplicado) {
                    mostrarAvisoRegistro(`⚠️ El Responsable #2 debe ser una persona distinta al Responsable #1 (${detalleDuplicado}).`);
                    if (primerError) {
                        primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        primerError.focus();
                    }
                    return false;
                }

                // Si llenó parte de Responsable #2 pero le faltan campos esenciales
                const camposR2 = [
                    { el: rep2Nom, val: rep2Nom.value.trim() },
                    { el: rep2CI, val: rep2CI.value.trim() },
                    { el: rep2Mail, val: rep2Mail.value.trim() },
                    { el: rep2Tel, val: rep2Tel.value.trim() },
                    { el: rep2Dep, val: rep2Dep ? rep2Dep.value.trim() : 'ok' }
                ];
                let faltaR2 = false;
                camposR2.forEach(c => {
                    if (!c.val) {
                        c.el.classList.add('border-red-500', 'bg-red-900/10', 'animate-pulse');
                        setTimeout(() => c.el.classList.remove('animate-pulse'), 500);
                        if (!primerError) primerError = c.el;
                        faltaR2 = true;
                        esValido = false;
                    }
                });
                if (rep2Dep && rep2Dep.value === 'Otro' && rep2DepOtro && !rep2DepOtro.value.trim()) {
                    rep2DepOtro.classList.add('border-red-500', 'bg-red-900/10');
                    if (!primerError) primerError = rep2DepOtro;
                    faltaR2 = true;
                    esValido = false;
                }
                if (faltaR2) {
                    mostrarAvisoRegistro("⚠️ Si registras al Responsable #2, por favor completa todos sus datos de contacto.");
                    if (primerError) {
                        primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        primerError.focus();
                    }
                    return false;
                }
            }
        }
    }

    // 4. Validación de capitán en paso 3
    if (step === 3 && !document.querySelector('input[name="capitan"]:checked')) {
        mostrarAvisoRegistro("⚠️ Debes seleccionar cuál de los 5 titulares es el Capitán del equipo.");
        const firstCapitan = document.querySelector('input[name="capitan"]');
        if (firstCapitan) firstCapitan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    if (!esValido) {
        if (primerError) {
            primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            primerError.focus();
        }
        if (hayVacios && hayFormatoInvalido) {
            mostrarAvisoRegistro("⚠️ Completa los campos obligatorios (*) y corrige los enlaces/correos marcados en rojo.");
        } else if (hayFormatoInvalido) {
            mostrarAvisoRegistro("⚠️ Revisa los campos con formato incorrecto (enlace o correo no válido).");
        } else {
            mostrarAvisoRegistro("⚠️ Completa todos los campos obligatorios (*) marcados en rojo antes de continuar.");
        }
    }

    return esValido;
};

window.goToStep = (step) => {
    if (step > currentStep && !window.validarPasoActual(currentStep)) return;
    document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        const target = document.getElementById(`step-${step}`);
        if (target) target.classList.add('active');
        document.getElementById('step-indicator').innerText = `Paso ${step} de 5`;
        for (let i = 1; i <= 5; i++) {
            const dot = document.getElementById(`dot-${i}`);
            if (dot) dot.classList.replace(i <= step ? 'bg-gray-800' : 'bg-blue-500', i <= step ? 'bg-blue-500' : 'bg-gray-800');
        }
        currentStep = step;
    }, 100); 
};

document.getElementById('lbl-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    for (let s = 1; s <= 5; s++) {
        if (!window.validarPasoActual(s)) {
            window.goToStep(s);
            return;
        }
    }

    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin text-2xl"></i> PROCESANDO...';

    const getDepReal = (prefix) => {
        const selectVal = document.getElementById(`${prefix}Dep`).value;
        return selectVal === 'Otro' ? document.getElementById(`${prefix}DepOtro`).value : selectVal;
    };

    const getPlayerData = (prefix, isSuplente = false) => {
        const nombre = document.getElementById(`${prefix}_nombre`).value;
        if (!nombre) return null;
        
        const data = {
            nombre,
            ci: document.getElementById(`${prefix}_ci`).value,
            ci_complemento: document.getElementById(`${prefix}_ciComp`).value || "",
            tel: document.getElementById(`${prefix}_tel`).value,
            mail: document.getElementById(`${prefix}_mail`).value,
            departamento: getDepReal(prefix),
            discordId: document.getElementById(`${prefix}_discord`).value,
            riotId: document.getElementById(`${prefix}_riot`).value,
            opgg: document.getElementById(`${prefix}_opgg`).value,
            cuenta_secundaria: {
                servidor: document.getElementById(`${prefix}_region2`).value,
                riotId2: document.getElementById(`${prefix}_riot2`).value,
                opgg2: document.getElementById(`${prefix}_opgg2`).value
            }
        };
        if (isSuplente) {
            const rolSelect = document.getElementById(`${prefix}_rol`);
            if (rolSelect) data.rol_seleccionado = rolSelect.options[rolSelect.selectedIndex].text;
        }
        return data;
    };

    // Recolectar Streamers Dinámicos
    const streamersList = [];
    for (let i = 1; i <= 5; i++) {
        const nName = document.getElementById(`streamerName_${i}`);
        const nLink = document.getElementById(`streamLink_${i}`);
        if (nName && nLink && nName.value && nLink.value) {
            streamersList.push({ nombre: nName.value, link: nLink.value });
        }
    }

    const logoUrlIngresada = document.getElementById('teamLogo').value.trim();

    const equipoLBL = {
        estado: "Pendiente",
        timestamp: new Date().toISOString(),
        equipo: { 
            nombre: document.getElementById('teamName').value, 
            tag: document.getElementById('teamTag').value.toUpperCase(), // GUARDAR TAG
            tier: document.getElementById('teamTier').value, 
            logo: logoUrlIngresada 
        },
        media: { 
            streamers: streamersList, // GUARDAR ARREGLO DE STREAMERS
            ig: document.getElementById('socialIG').value, 
            tk: document.getElementById('socialTK').value 
        },
        representantes: [
            { nombre: document.getElementById('rep1Nombre').value, ci: document.getElementById('rep1CI').value, ci_complemento: document.getElementById('rep1CIComp').value, tel: document.getElementById('rep1Tel').value, mail: document.getElementById('rep1Mail').value, departamento: getDepReal('rep1') },
            { nombre: document.getElementById('rep2Nombre').value, ci: document.getElementById('rep2CI').value, ci_complemento: document.getElementById('rep2CIComp').value, tel: document.getElementById('rep2Tel').value, mail: document.getElementById('rep2Mail').value, departamento: getDepReal('rep2') }
        ].filter(r => r.nombre && r.nombre.trim() !== ''),
        roster: { TOP: getPlayerData('TOP'), JG: getPlayerData('JG'), MID: getPlayerData('MID'), ADC: getPlayerData('ADC'), SUPP: getPlayerData('SUPP') },
        capitan: document.querySelector('input[name="capitan"]:checked').value,
        suplentes: [getPlayerData('SUP1', true), getPlayerData('SUP2', true), getPlayerData('SUP3', true)].filter(Boolean),
        coaches: [getPlayerData('COACH1'), getPlayerData('COACH2')].filter(Boolean)
    };

    try {
        await addDoc(collection(db, "inscripciones_pendientes"), equipoLBL);
        localStorage.removeItem(STORAGE_KEY); 
        document.getElementById('modal-team-name').innerText = equipoLBL.equipo.nombre;
        
        const adminPhone = "59163842110"; // PON TU NÚMERO
        const msg = `LBL 2026: El equipo *${equipoLBL.equipo.nombre}* [${equipoLBL.equipo.tag}] (${equipoLBL.equipo.tier}) se ha registrado. Soy *${equipoLBL.roster[equipoLBL.capitan].nombre}* (Capitán).`;
        document.getElementById('whatsapp-btn').href = `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(msg)}`;
        document.getElementById('success-modal').classList.add('flex');
    } catch (error) {
        alert("Error de conexión. Revisa tu internet.");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
});