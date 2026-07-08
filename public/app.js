// public/app.js
import { db } from "./firebase-config.js";
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
};

document.addEventListener('input', saveToLocal);
document.addEventListener('change', saveToLocal);
document.addEventListener('DOMContentLoaded', loadFromLocal);

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
    if (e.target.id && e.target.id.endsWith('_region2')) {
        const riotInput = document.getElementById(`${e.target.id.split('_')[0]}_riot2`);
        if (riotInput.value) riotInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
});

window.validarPasoActual = (step) => {
    let esValido = true;
    let primerError = null;
    document.getElementById(`step-${step}`).querySelectorAll('input[required], select[required]').forEach(campo => {
        if (campo.type === 'email' && campo.value.trim() && !campo.checkValidity()) {
            esValido = false; campo.classList.add('border-red-500', 'bg-red-900/10'); if (!primerError) primerError = campo;
        } else if (!campo.value.trim()) {
            esValido = false; campo.classList.add('border-red-500', 'bg-red-900/10', 'animate-pulse');
            setTimeout(() => campo.classList.remove('animate-pulse'), 500);
            if (!primerError) primerError = campo;
        }
    });

    if (step === 3 && !document.querySelector('input[name="capitan"]:checked')) { alert("⚠️ Selecciona al Capitán del equipo."); return false; }
    if (!esValido && primerError) { primerError.scrollIntoView({ behavior: 'smooth', block: 'center' }); primerError.focus(); }
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
    if (!window.validarPasoActual(5)) return;

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

    const equipoLBL = {
        estado: "Pendiente",
        timestamp: new Date().toISOString(),
        equipo: { 
            nombre: document.getElementById('teamName').value, 
            tag: document.getElementById('teamTag').value.toUpperCase(), // GUARDAR TAG
            tier: document.getElementById('teamTier').value, 
            logo: document.getElementById('teamLogo').value 
        },
        media: { 
            streamers: streamersList, // GUARDAR ARREGLO DE STREAMERS
            ig: document.getElementById('socialIG').value, 
            tk: document.getElementById('socialTK').value 
        },
        representantes: [
            { nombre: document.getElementById('rep1Nombre').value, ci: document.getElementById('rep1CI').value, ci_complemento: document.getElementById('rep1CIComp').value, tel: document.getElementById('rep1Tel').value, mail: document.getElementById('rep1Mail').value, departamento: getDepReal('rep1') },
            { nombre: document.getElementById('rep2Nombre').value, ci: document.getElementById('rep2CI').value, ci_complemento: document.getElementById('rep2CIComp').value, tel: document.getElementById('rep2Tel').value, mail: document.getElementById('rep2Mail').value, departamento: getDepReal('rep2') }
        ],
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