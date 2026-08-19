/**
 * ==============================================================================
 * DIRECTORIO OFICIAL DE STAFF LBL (ASIGNACIÓN DE NICKS / ALIAS)
 * ==============================================================================
 * En este archivo puedes asignar o modificar el Nick de cada integrante del Staff.
 * Cuando un miembro inicia sesión con su correo de Firebase Auth, el sistema
 * buscará su correo aquí y mostrará su Nick en la sesión, auditoría y notificaciones.
 * 
 * Estructura: "correo_en_minusculas@ejemplo.com": "Nick / Alias"
 */

export const STAFF_DIRECTORY = {
    // Cuenta Principal / Fundador
    "jhonatan123progame@gmail.com": "Darkcito",

    // Agrega o edita los correos del resto del Staff aquí abajo:
    "iluigi.xd@gmail.com": "Luico",
    "poolphoenix2324@gmail.com": "Pol",
    "leoduran651@gmail.com": "Ren Noroi",
    "balderramaalexander765@gmail.com": "Aliaselalex",
    "silesgalarzabts@hotmail.com": "Ketwi",
    "lf2018.00@gmail.com" : "Luis F.",
     
};

/**
 * Obtiene el Nick asignado a un correo del Staff.
 * Si el correo no está registrado en la lista, formatea un nombre legible.
 * @param {string} emailOrText - Correo o etiqueta de autor
 * @returns {string} Nick del Staff
 */
export function getStaffNick(emailOrText) {
    if (!emailOrText) return "Staff LBL";
    const str = emailOrText.toString().trim();
    const lower = str.toLowerCase();
    
    // 1. Coincidencia exacta de correo
    if (STAFF_DIRECTORY[lower]) {
        return STAFF_DIRECTORY[lower];
    }
    
    // 2. Extraer correo si viene en formatos como "Staff (correo@...)"
    const emailMatch = lower.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && emailMatch[1]) {
        const foundEmail = emailMatch[1];
        if (STAFF_DIRECTORY[foundEmail]) {
            return STAFF_DIRECTORY[foundEmail];
        }
        // Fallback si no está en la lista: usar el usuario del correo
        const userPart = foundEmail.split('@')[0];
        return userPart.toUpperCase();
    }

    // 3. Si ya es un nombre o nick sin @
    const cleanNick = str.replace(/^Staff\s*\((.*)\)$/i, '$1').trim();
    return cleanNick || str;
}

/**
 * Genera la etiqueta oficial para registrar en los logs de auditoría: "Staff (Nick)"
 * @param {string} emailOrText 
 * @returns {string} "Staff (Nick)"
 */
export function formatStaffAuthor(emailOrText) {
    const nick = getStaffNick(emailOrText);
    return `Staff (${nick})`;
}
