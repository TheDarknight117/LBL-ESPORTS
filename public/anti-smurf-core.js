/**
 * anti-smurf-core.js
 * Motor Forense Anti-Smurf, Anti-Suplantación y Rastreator Multi-Base (LBL Esports)
 *
 * Cruza en tiempo real a cada jugador inscrito en torneos específicos (ej. Torneo Presencial
 * Aquí Me Quedo [La Paz] vs Smokelander Center [Cochabamba] — Tope Esmeralda 1) contra:
 *   1. Scouting 1 (/assets/scouting1.json)
 *   2. Scouting 2 (/assets/scouting2.json + caché local S2)
 *   3. Open Qualifier LBL (/assets/qualifier.json)
 *   4. Scouting 3 (Google Apps Script API oficial + caché/Firestore)
 *   5. Liga LBL Oficial — Tier 1 y Tier 2 (Firestore inscripciones_pendientes: titulares, suplentes, ex_jugadores, reps)
 *   6. Lista Negra Oficial de Sancionados (BANNED_PLAYERS / BANNED_TEAMS)
 */

export const TORNEO_LAN_ID = 'amq_vs_smok_2026';
export const TORNEO_LAN_COLLECTION = 'inscripciones_torneos';
export const TORNEO_LAN_PUBLIC_DOC = 'torneo_lan_amq_smok_public';
export const TORNEO_LAN_MAX_CUPOS_SEDE = 16;

export const SCOUTING3_OFFICIAL_API_URL =
    'https://script.google.com/macros/s/AKfycbz6hv8P9i4bC7Mm-QmAI0DJHQNE7wYLZ7-RhM-C9v8moDT0UEo72Db6QsFh1VNYQCD0/exec';

export const BANNED_TEAMS = [
    'bulevar de los sueños rotos',
    'bulevar de los suenos rotos',
    'bsr'
];

export const BANNED_PLAYERS = [
    'levius cromwell #k1ng',
    'levius cromwell',
    'aldo luciano heredia arancibia',
    'aldo luciano heredia',
    'kapriely'
];

export const RANGOS_SOLOQ_TORNEO_LAN = [
    { value: 'Unranked', label: 'Unranked / Sin Clasificar', tierNum: 0, excedeEsmeralda1: false },
    { value: 'Hierro', label: 'Hierro (IV - I)', tierNum: 1, excedeEsmeralda1: false },
    { value: 'Bronce', label: 'Bronce (IV - I)', tierNum: 2, excedeEsmeralda1: false },
    { value: 'Plata', label: 'Plata (IV - I)', tierNum: 3, excedeEsmeralda1: false },
    { value: 'Oro', label: 'Oro (IV - I)', tierNum: 4, excedeEsmeralda1: false },
    { value: 'Platino 4', label: 'Platino IV', tierNum: 5, excedeEsmeralda1: false },
    { value: 'Platino 3', label: 'Platino III', tierNum: 5, excedeEsmeralda1: false },
    { value: 'Platino 2', label: 'Platino II', tierNum: 5, excedeEsmeralda1: false },
    { value: 'Platino 1', label: 'Platino I', tierNum: 5, excedeEsmeralda1: false },
    { value: 'Esmeralda 4', label: 'Esmeralda IV', tierNum: 6, excedeEsmeralda1: false },
    { value: 'Esmeralda 3', label: 'Esmeralda III', tierNum: 6, excedeEsmeralda1: false },
    { value: 'Esmeralda 2', label: 'Esmeralda II', tierNum: 6, excedeEsmeralda1: false },
    { value: 'Esmeralda 1', label: 'Esmeralda I', tierNum: 7, excedeEsmeralda1: false }
];

export const REGIONES_OPGG_TORNEO_LAN = [
    { value: 'las', label: 'LAS (Latam Sur)' },
    { value: 'lan', label: 'LAN (Latam Norte)' },
    { value: 'br', label: 'BR (Brasil)' },
    { value: 'na', label: 'NA (Norteamérica)' },
    { value: 'euw', label: 'EUW (Europa W)' },
    { value: 'eune', label: 'EUNE (Europa N/E)' },
    { value: 'kr', label: 'KR (Corea)' },
    { value: 'jp', label: 'JP (Japón)' },
    { value: 'oce', label: 'OCE (Oceanía)' },
    { value: 'tr', label: 'TR (Turquía)' },
    { value: 'ru', label: 'RU (Rusia)' },
    { value: 'sea', label: 'SEA (Asia SE)' },
    { value: 'tw', label: 'TW (Taiwán)' },
    { value: 'vn', label: 'VN (Vietnam)' },
    { value: 'me', label: 'ME (Medio Oriente)' }
];

const REGION_OPGG_SET = new Set(REGIONES_OPGG_TORNEO_LAN.map(r => r.value));
const REGION_OPGG_ALIAS = {
    eu: 'euw',
    sg: 'sea',
    sg2: 'sea',
    ph: 'sea',
    ph2: 'sea',
    th: 'sea',
    th2: 'sea',
    oc: 'oce',
    oc1: 'oce',
    la1: 'lan',
    la2: 'las',
    br1: 'br',
    na1: 'na',
    euw1: 'euw',
    eun1: 'eune',
    kr1: 'kr',
    jp1: 'jp',
    tr1: 'tr',
    tw2: 'tw',
    vn2: 'vn',
    me1: 'me'
};

// ============================================================================
// 1. FUNCIONES DE NORMALIZACIÓN DE IDENTIDAD (CELULAR, C.I., NOMBRE, RIOT ID)
// ============================================================================

export function quitarAcentos(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza números de celular (especialmente de Bolivia +591 7xxxxxxx / 6xxxxxxx).
 * Si tiene prefijo 591 y luego 8 dígitos, devuelve los 8 dígitos limpios para match exacto.
 */
export function normalizarCelular(raw) {
    if (!raw) return '';
    const digits = String(raw).replace(/\D+/g, '');
    if (!digits || digits.length < 7) return '';
    if (digits.length === 11 && digits.startsWith('591')) {
        return digits.slice(3);
    }
    if (digits.length > 8 && (digits.startsWith('5916') || digits.startsWith('5917'))) {
        return digits.slice(3, 11);
    }
    return digits;
}

/**
 * Extrae el número de C.I. (6 a 9 dígitos) tanto de un campo limpio como de un string combinado "Nombre + CI" (Scouting 3).
 */
export function extraerCiLimpio(raw) {
    if (!raw) return '';
    const str = String(raw).trim();
    const match = str.match(/\b(\d{6,10})\b/);
    if (match) return match[1];
    const onlyDigits = str.replace(/\D+/g, '');
    if (onlyDigits.length >= 6 && onlyDigits.length <= 10) return onlyDigits;
    return '';
}

/**
 * Extrae y normaliza el nombre de una persona (quitando números de C.I., extensiones LP/CBBA/SCZ y tildes).
 */
export function normalizarNombrePersona(raw) {
    if (!raw) return '';
    let s = quitarAcentos(String(raw).toLowerCase());
    // Quitar bloques numéricos de CI y siglas departamentales sueltas al final
    s = s
        .replace(/\b\d{5,10}[a-z0-9-]*\b/g, ' ')
        .replace(/[^a-zñ\s]/g, ' ')
        .replace(/\b(lp|lpz|cbba|cba|scz|sc|or|pt|tj|ch|bn|pd|bo)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return s;
}

/**
 * Extrae el nombre legible (con mayúsculas) cuando viene combinado con C.I. en Scouting 3.
 */
export function limpiarNombreVisible(raw) {
    if (!raw) return '';
    return String(raw)
        .replace(/[-–—/|,:]?\s*\b\d{6,10}(?:-[0-9A-Za-z]{1,3})?\b\s*(?:LP|CBBA|CBA|SCZ|OR|PT|TJ|CH|BN|PD)?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const STOPWORDS_NOMBRES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'san', 'santa', 'y']);

export function obtenerTokensNombre(raw) {
    const norm = normalizarNombrePersona(raw);
    if (!norm) return [];
    return norm
        .split(' ')
        .map(t => t.trim())
        .filter(t => t.length >= 3 && !STOPWORDS_NOMBRES.has(t));
}

/**
 * Compara si dos nombres corresponden con alta probabilidad a la misma persona física.
 * Devuelve { coincide: boolean, exacto: boolean, tokensComunes: number }
 */
export function compararNombresPersona(nombreA, nombreB) {
    const normA = normalizarNombrePersona(nombreA);
    const normB = normalizarNombrePersona(nombreB);
    if (!normA || !normB || normA.length < 5 || normB.length < 5) {
        return { coincide: false, exacto: false, tokensComunes: 0 };
    }
    if (normA === normB) {
        return { coincide: true, exacto: true, tokensComunes: normA.split(' ').length };
    }

    const tokensA = obtenerTokensNombre(normA);
    const tokensB = obtenerTokensNombre(normB);
    if (tokensA.length < 2 || tokensB.length < 2) {
        return { coincide: false, exacto: false, tokensComunes: 0 };
    }

    const setB = new Set(tokensB);
    const comunes = tokensA.filter(t => setB.has(t));
    // Coincidencia fuerte: al menos 3 tokens iguales, o 2 tokens iguales cuando uno de los nombres solo tiene 2 palabras (Nombre + Apellido)
    if (comunes.length >= 3) {
        return { coincide: true, exacto: false, tokensComunes: comunes.length };
    }
    if (comunes.length === 2 && (tokensA.length === 2 || tokensB.length === 2)) {
        // Verificar que no sean solo dos nombres de pila súper comunes sin apellido
        return { coincide: true, exacto: false, tokensComunes: 2 };
    }
    return { coincide: false, exacto: false, tokensComunes: comunes.length };
}

const IGNORE_RIOT_VALUES = new Set([
    'n/a', 'na', 'no', 'ninguno', 'ninguna', '-', '--', 'none', 'misma', 'mismo',
    'la misma', 'el mismo', 'no aplica', 'no tengo', 'same', 'sin cuenta', 'las',
    'no posee', 'ningun', 'no cuento', 'sin cuenta externa', 'no tiene', 'sin main',
    'sin cuenta main', 'unranked'
]);

export function normalizarRiotId(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed || IGNORE_RIOT_VALUES.has(trimmed)) return '';
    const compact = trimmed.replace(/\s+/g, '');
    if (compact.length < 3 || IGNORE_RIOT_VALUES.has(compact)) return '';
    return compact;
}

export function extraerNickBaseRiot(raw) {
    const norm = normalizarRiotId(raw);
    if (!norm) return '';
    const base = norm.split('#')[0].trim();
    return base.length >= 3 ? base : '';
}

export function normalizarDiscord(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim().toLowerCase().replace(/\s+/g, '');
    if (!s || s.length < 3 || IGNORE_RIOT_VALUES.has(s)) return '';
    return s;
}

export function normalizarRegionOpgg(rawRegion) {
    if (!rawRegion || typeof rawRegion !== 'string') return '';
    const clean = rawRegion.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) return '';
    if (REGION_OPGG_SET.has(clean)) return clean;
    return REGION_OPGG_ALIAS[clean] || '';
}

export function extraerRegionDeUrlOpgg(url) {
    if (!url || typeof url !== 'string') return '';
    const m = url.match(/op\.gg\/(?:[a-z]{2}\/lol\/)?summoners\/([a-z0-9]+)/i);
    return m ? normalizarRegionOpgg(m[1]) : '';
}

export function inferirRegionOpggDeRiotId(riotId) {
    if (!riotId || typeof riotId !== 'string' || !riotId.includes('#')) return '';
    const tagPart = riotId.split('#').slice(1).join('#').trim().toLowerCase().replace(/\s+/g, '');
    return normalizarRegionOpgg(tagPart);
}

export function resolverRegionMainJugador(jugador) {
    if (!jugador || typeof jugador !== 'object') return 'las';
    const explicita = normalizarRegionOpgg(jugador.regionMain || jugador.servidorMain || '');
    if (explicita) return explicita;

    const regDeUrl = extraerRegionDeUrlOpgg(jugador.opggMain || '');
    if (regDeUrl && regDeUrl !== 'las') return regDeUrl;

    const regDeTag = inferirRegionOpggDeRiotId(jugador.riotIdMain || '');
    if (regDeTag) return regDeTag;

    return regDeUrl || 'las';
}

export function resolverUrlOpggMainJugador(jugador) {
    const riotMain = String(jugador?.riotIdMain || '').trim();
    if (!riotMain || IGNORE_RIOT_VALUES.has(riotMain.toLowerCase())) return '';
    const region = resolverRegionMainJugador(jugador);
    const tieneRegionExplicita = Boolean(normalizarRegionOpgg(jugador?.regionMain || jugador?.servidorMain || ''));
    if (tieneRegionExplicita || region !== 'las') {
        return construirUrlOpgg(riotMain, region);
    }
    return String(jugador?.opggMain || '').trim() || construirUrlOpgg(riotMain, region);
}

export function construirUrlOpgg(riotId, region = 'las') {
    if (!riotId || typeof riotId !== 'string') return '';
    const clean = riotId.trim();
    if (!clean || IGNORE_RIOT_VALUES.has(clean.toLowerCase())) return '';
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (!clean.includes('#')) return '';
    const [rawName, ...restTag] = clean.split('#');
    const gameName = rawName.trim();
    const tagLine = restTag.join('#').trim();
    if (!gameName || !tagLine) return '';
    const regSlug = normalizarRegionOpgg(region) || 'las';
    return `https://www.op.gg/summoners/${regSlug}/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`;
}

// ============================================================================
// 2. EVALUADOR DE RANGO SOLOQ Y DETECTOR DE TOPE ESMERALDA 1
// ============================================================================

/**
 * Analiza cualquier string de rango (ej. "Master", "Gran-Maestro", "Diamante 2 - 4", "Esmeralda 1", "Peak Diamante 3 / Actual Esmeralda 2")
 * y determina si supera el tope permitido de Esmeralda 1.
 */
export function evaluarRangoSoloQ(rawRank) {
    if (!rawRank) {
        return {
            raw: 'Unranked',
            etiqueta: 'Unranked',
            tierNum: 0,
            excedeEsmeralda1: false,
            nivelAlerta: 'ok'
        };
    }

    const str = String(rawRank).trim();
    const norm = quitarAcentos(str.toLowerCase());

    // Detectar rangos superiores a Esmeralda 1 (incluso si mencionan peak y actual juntos)
    if (norm.includes('challenger') || norm.includes('retador')) {
        return { raw: str, etiqueta: 'Challenger / Retador', tierNum: 11, excedeEsmeralda1: true, nivelAlerta: 'critica' };
    }
    if (
        norm.includes('grandmaster') ||
        norm.includes('grand master') ||
        norm.includes('gran maestro') ||
        norm.includes('gran-maestro') ||
        /\bgm\b/.test(norm)
    ) {
        return { raw: str, etiqueta: 'Grandmaster', tierNum: 10, excedeEsmeralda1: true, nivelAlerta: 'critica' };
    }
    if (norm.includes('master') || norm.includes('maestro')) {
        return { raw: str, etiqueta: 'Master / Maestro', tierNum: 9, excedeEsmeralda1: true, nivelAlerta: 'critica' };
    }
    if (norm.includes('diamante') || norm.includes('diamond') || /\bd[1-4]\b/.test(norm)) {
        return { raw: str, etiqueta: 'Diamante', tierNum: 8, excedeEsmeralda1: true, nivelAlerta: 'critica' };
    }

    // Rangos permitidos (<= Esmeralda 1)
    if (norm.includes('esmeralda') || norm.includes('emerald')) {
        const esE1 = /esmeralda\s*(1|i\b)/i.test(norm) || /emerald\s*(1|i\b)/i.test(norm);
        return {
            raw: str,
            etiqueta: esE1 ? 'Esmeralda 1 (En el Tope)' : 'Esmeralda',
            tierNum: esE1 ? 7 : 6,
            excedeEsmeralda1: false,
            nivelAlerta: 'ok'
        };
    }
    if (norm.includes('platino') || norm.includes('platinum')) {
        return { raw: str, etiqueta: 'Platino', tierNum: 5, excedeEsmeralda1: false, nivelAlerta: 'ok' };
    }
    if (norm.includes('oro') || norm.includes('gold')) {
        return { raw: str, etiqueta: 'Oro', tierNum: 4, excedeEsmeralda1: false, nivelAlerta: 'ok' };
    }
    if (norm.includes('plata') || norm.includes('silver')) {
        return { raw: str, etiqueta: 'Plata', tierNum: 3, excedeEsmeralda1: false, nivelAlerta: 'ok' };
    }
    if (norm.includes('bronce') || norm.includes('bronze')) {
        return { raw: str, etiqueta: 'Bronce', tierNum: 2, excedeEsmeralda1: false, nivelAlerta: 'ok' };
    }
    if (norm.includes('hierro') || norm.includes('iron')) {
        return { raw: str, etiqueta: 'Hierro', tierNum: 1, excedeEsmeralda1: false, nivelAlerta: 'ok' };
    }

    return {
        raw: str,
        etiqueta: str || 'Unranked',
        tierNum: 0,
        excedeEsmeralda1: false,
        nivelAlerta: 'ok'
    };
}

export function esPersonaBaneada( { nombre, riotId, riotIdMain, discord } = {} ) {
    const targets = [nombre, riotId, riotIdMain, discord]
        .filter(Boolean)
        .map(s => quitarAcentos(String(s).toLowerCase().trim()));
    if (!targets.length) return null;

    for (const banned of BANNED_PLAYERS) {
        const bNorm = quitarAcentos(banned.toLowerCase().trim());
        const bNick = bNorm.split('#')[0].trim();
        for (const t of targets) {
            const tNick = t.split('#')[0].trim();
            if (t === bNorm || t.includes(bNorm) || (bNick.length >= 5 && tNick === bNick)) {
                return banned;
            }
        }
    }
    return null;
}

// ============================================================================
// 3. CARGADOR E INDEXADOR UNIFICADO DE LAS 6 BASES DE DATOS HISTÓRICAS LBL
// ============================================================================

let cachedHistoricalIndex = null;
let cachedHistoricalTimestamp = 0;

function crearEntradaIndiceVacia() {
    return {
        registros: [], // Todas las filas normalizadas
        porCi: new Map(),
        porCelular: new Map(),
        porRiotFull: new Map(),
        porRiotNick: new Map(),
        porDiscord: new Map(),
        porNombreExacto: new Map(),
        resumenFuentes: {
            scouting1: 0,
            scouting2: 0,
            qualifier: 0,
            scouting3: 0,
            ligaTier1: 0,
            ligaTier2: 0
        }
    };
}

function pushToMapArray(map, key, item) {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
}

function registrarEnIndice(idx, rawRecord) {
    const ci = extraerCiLimpio(rawRecord.ci || rawRecord.nombre || '');
    const nombreVisible = limpiarNombreVisible(rawRecord.nombre || '');
    const nombreNorm = normalizarNombrePersona(nombreVisible || rawRecord.nombre || '');
    const celular = normalizarCelular(rawRecord.celular || '');
    const riot1 = normalizarRiotId(rawRecord.riotId || '');
    const riot2 = normalizarRiotId(rawRecord.riotIdMain || '');
    const nick1 = extraerNickBaseRiot(rawRecord.riotId || '');
    const nick2 = extraerNickBaseRiot(rawRecord.riotIdMain || '');
    const discord = normalizarDiscord(rawRecord.discord || '');
    const evalRango = evaluarRangoSoloQ(rawRecord.rango || '');

    if (!ci && !nombreNorm && !celular && !riot1 && !riot2) return;

    const entry = {
        id: rawRecord.id || `rec_${idx.registros.length + 1}`,
        fuenteCodigo: rawRecord.fuenteCodigo, // 'SC1' | 'SC2' | 'OQ' | 'SC3' | 'LIGA_T1' | 'LIGA_T2'
        fuenteNombre: rawRecord.fuenteNombre, // 'Scouting 1' | 'Scouting 2' | ...
        esLigaTier1: Boolean(rawRecord.esLigaTier1),
        esLigaTier2: Boolean(rawRecord.esLigaTier2),
        esExJugadorLiga: Boolean(rawRecord.esExJugadorLiga),
        equipoNombre: rawRecord.equipoNombre || 'Sin Equipo',
        equipoTag: rawRecord.equipoTag || '',
        equipoEstado: rawRecord.equipoEstado || 'Registrado',
        rol: rawRecord.rol || 'Titular',
        rolSecundario: rawRecord.rolSecundario || '',
        nombre: nombreVisible || rawRecord.nombre || '',
        nombreNorm,
        tokensNombre: obtenerTokensNombre(nombreVisible || rawRecord.nombre || ''),
        ci,
        celular,
        celularRaw: rawRecord.celular || '',
        discord: rawRecord.discord || '',
        discordNorm: discord,
        riotId: (rawRecord.riotId || '').trim(),
        riotIdMain: (rawRecord.riotIdMain || '').trim(),
        regionMain: rawRecord.riotIdMain ? resolverRegionMainJugador(rawRecord) : '',
        riot1Norm: riot1,
        riot2Norm: riot2,
        nick1Norm: nick1,
        nick2Norm: nick2,
        opgg: rawRecord.opgg || construirUrlOpgg(rawRecord.riotId),
        opggMain: rawRecord.riotIdMain ? resolverUrlOpggMainJugador(rawRecord) : '',
        rango: rawRecord.rango || 'Unranked',
        evalRango,
        departamento: rawRecord.departamento || ''
    };

    const searchBlob = quitarAcentos(
        `${entry.nombre} ${entry.ci} ${entry.celular} ${entry.riotId} ${entry.riotIdMain} ${entry.discord} ${entry.equipoNombre} ${entry.equipoTag} ${entry.fuenteNombre} ${entry.rango}`
            .toLowerCase()
    );
    entry._searchBlob = searchBlob;

    idx.registros.push(entry);

    if (ci) pushToMapArray(idx.porCi, ci, entry);
    if (celular) pushToMapArray(idx.porCelular, celular, entry);
    if (riot1) pushToMapArray(idx.porRiotFull, riot1, entry);
    if (riot2 && riot2 !== riot1) pushToMapArray(idx.porRiotFull, riot2, entry);
    if (nick1) pushToMapArray(idx.porRiotNick, nick1, entry);
    if (nick2 && nick2 !== nick1) pushToMapArray(idx.porRiotNick, nick2, entry);
    if (discord) pushToMapArray(idx.porDiscord, discord, entry);
    if (nombreNorm && nombreNorm.length >= 5) pushToMapArray(idx.porNombreExacto, nombreNorm, entry);
}

function indexarJsonScoutingLegacy(idx, teamsArray, fuenteCodigo, fuenteNombre, counterKey) {
    if (!Array.isArray(teamsArray)) return;
    const rolesKeys = [
        { key: 'top', label: 'TOP' },
        { key: 'jg', label: 'JG' },
        { key: 'mid', label: 'MID' },
        { key: 'adc', label: 'ADC' },
        { key: 'supp', label: 'SUPP' }
    ];

    teamsArray.forEach((team, tIdx) => {
        if (!team) return;
        const eqNombre = team.name || team.nombre || `Equipo #${tIdx + 1}`;
        const eqTag = team.tag || '';

        rolesKeys.forEach(({ key, label }) => {
            const p = team[key];
            if (p && (p.name || p.lol_id || p.phone)) {
                registrarEnIndice(idx, {
                    id: `${fuenteCodigo}_${tIdx}_${label}`,
                    fuenteCodigo,
                    fuenteNombre,
                    equipoNombre: eqNombre,
                    equipoTag: eqTag,
                    rol: label,
                    rolSecundario: p.sec_role || '',
                    nombre: p.name || '',
                    celular: p.phone || '',
                    discord: p.discord || '',
                    riotId: p.lol_id || '',
                    opgg: p.opgg || '',
                    rango: p.rank || 'Unranked'
                });
                idx.resumenFuentes[counterKey]++;
            }
        });

        if (Array.isArray(team.subs)) {
            team.subs.forEach((sub, sIdx) => {
                if (sub && (sub.name || sub.lol_id || sub.phone)) {
                    registrarEnIndice(idx, {
                        id: `${fuenteCodigo}_${tIdx}_SUB${sIdx + 1}`,
                        fuenteCodigo,
                        fuenteNombre,
                        equipoNombre: eqNombre,
                        equipoTag: eqTag,
                        rol: sub.role || `Suplente #${sIdx + 1}`,
                        rolSecundario: sub.sec_role || '',
                        nombre: sub.name || '',
                        celular: sub.phone || '',
                        discord: sub.discord || '',
                        riotId: sub.lol_id || '',
                        opgg: sub.opgg || '',
                        rango: sub.rank || 'Unranked'
                    });
                    idx.resumenFuentes[counterKey]++;
                }
            });
        }
    });
}

function indexarEquiposScouting3(idx, equiposSc3) {
    if (!Array.isArray(equiposSc3)) return;
    equiposSc3.forEach((eq, eIdx) => {
        if (!eq) return;
        const estadoEq = String(eq.estado || 'Pendiente').trim();
        const eqNombre = eq.nombre || eq.name || `Equipo SC3 #${eIdx + 1}`;
        const eqTag = eq.tag || '';
        const capTel = eq.capitan?.telefono || eq.repPhone || '';
        const capNomNorm = normalizarNombrePersona(eq.capitan?.nombreCi || '');

        const procesarJugSc3 = (j, rolFallback) => {
            if (!j || (!j.nombreCi && !j.riotIdLas && !j.lol_id && !j.name)) return;
            const rawNombreCi = j.nombreCi || j.name || '';
            const jugNomNorm = normalizarNombrePersona(rawNombreCi);
            // Si el jugador coincide con el capitán del equipo en SC3, asociar el teléfono del capitán
            const esElCapitan = Boolean(capTel && capNomNorm && jugNomNorm && capNomNorm === jugNomNorm);

            registrarEnIndice(idx, {
                id: `SC3_${eq.rowId || eIdx}_${rolFallback}`,
                fuenteCodigo: 'SC3',
                fuenteNombre: 'Scouting 3',
                equipoNombre: eqNombre,
                equipoTag: eqTag,
                equipoEstado: estadoEq,
                rol: j.posicion || j.rolPrincipal || j.role || rolFallback,
                rolSecundario: j.rolSecundario || j.sec_role || '',
                nombre: rawNombreCi,
                ci: j.ci || extraerCiLimpio(rawNombreCi),
                celular: j.telefono || j.phone || (esElCapitan ? capTel : ''),
                discord: j.discord || '',
                riotId: j.riotIdLas || j.lol_id || '',
                riotIdMain: j.riotIdMain || '',
                opgg: j.opggLas || j.opgg || '',
                opggMain: j.opggMain || '',
                rango: j.rangoSoloQ || j.rank || 'Unranked',
                departamento: j.residencia || ''
            });
            idx.resumenFuentes.scouting3++;
        };

        if (Array.isArray(eq.titulares)) {
            eq.titulares.forEach((t, i) => procesarJugSc3(t, `${t?.posicion || 'TIT'}_${i + 1}`));
        } else {
            ['top', 'jg', 'mid', 'adc', 'supp'].forEach(k => {
                if (eq[k]) procesarJugSc3(eq[k], k.toUpperCase());
            });
        }

        const subs = Array.isArray(eq.suplentes) ? eq.suplentes : (Array.isArray(eq.subs) ? eq.subs : []);
        subs.forEach((s, i) => procesarJugSc3(s, `SUB_${i + 1}`));
    });
}

function indexarEquiposLigaLBL(idx, docsLiga) {
    if (!Array.isArray(docsLiga)) return;
    docsLiga.forEach((data, dIdx) => {
        if (!data) return;
        const estadoDoc = String(data.estado || 'Aceptado').trim();
        // Ignorar registros rechazados en Liga para no generar falsos bloqueos de participación en Liga, pero sí indexarlos si se desea trazabilidad de identidad
        const eqObj = data.equipo && typeof data.equipo === 'object' ? data.equipo : {};
        const eqNombre = eqObj.nombre || data.nombreEquipo || data.nombre || `Equipo Liga #${dIdx + 1}`;
        const eqTag = eqObj.tag || data.tag || '';
        const tierRaw = String(eqObj.tier || data.tier || 'Tier 1').trim();
        const esTier2 = tierRaw.toLowerCase().includes('2');
        const esTier1 = !esTier2;
        const fuenteCodigo = esTier1 ? 'LIGA_T1' : 'LIGA_T2';
        const fuenteNombre = esTier1 ? `Liga LBL (Tier 1)` : `Liga LBL (Tier 2)`;

        const registrarMiembroLiga = (p, rolLabel, esEx = false) => {
            if (!p || (!p.nombre && !p.riotId && !p.ci && !p.tel && !p.telefono)) return;
            const r2 = p.cuenta_secundaria?.riotId2 || p.riotId2 || '';
            const reg2 = p.cuenta_secundaria?.servidor || p.cuenta_secundaria?.region2 || '';
            const opgg2 = p.cuenta_secundaria?.opgg2 || '';
            registrarEnIndice(idx, {
                id: `${fuenteCodigo}_${data.id || dIdx}_${rolLabel}`,
                fuenteCodigo,
                fuenteNombre: esEx ? `${fuenteNombre} • Ex-Jugador` : `${fuenteNombre} • ${estadoDoc}`,
                esLigaTier1: esTier1 && estadoDoc.toLowerCase() !== 'rechazado',
                esLigaTier2: esTier2 && estadoDoc.toLowerCase() !== 'rechazado',
                esExJugadorLiga: esEx,
                equipoNombre: eqNombre,
                equipoTag: eqTag,
                equipoEstado: estadoDoc,
                rol: rolLabel,
                nombre: p.nombre || p.nombreCi || '',
                ci: p.ci || '',
                celular: p.tel || p.telefono || '',
                discord: p.discordId || p.discord || '',
                riotId: p.riotId || p.riotIdLas || '',
                riotIdMain: r2,
                regionMain: reg2,
                opgg: p.opgg || '',
                opggMain: opgg2,
                rango: tierRaw,
                departamento: p.departamento || ''
            });
            if (esTier1) idx.resumenFuentes.ligaTier1++;
            else idx.resumenFuentes.ligaTier2++;
        };

        if (data.roster && typeof data.roster === 'object') {
            ['TOP', 'JG', 'MID', 'ADC', 'SUPP'].forEach(rol => {
                if (data.roster[rol]) registrarMiembroLiga(data.roster[rol], rol, false);
            });
        }
        if (Array.isArray(data.suplentes)) {
            data.suplentes.forEach((s, i) => registrarMiembroLiga(s, s?.rol_seleccionado || `Suplente #${i + 1}`, false));
        }
        if (Array.isArray(data.jugadores)) {
            data.jugadores.forEach((jug, i) => registrarMiembroLiga(jug, jug?.posicion || `Jugador #${i + 1}`, false));
        }
        if (Array.isArray(data.ex_jugadores)) {
            data.ex_jugadores.forEach((ex, i) => registrarMiembroLiga(ex, `Ex-${ex?.rol || i + 1}`, true));
        }
    });
}

/**
 * Carga y construye el índice histórico unificado desde las 6 bases de datos.
 */
export async function cargarIndiceHistoricoGlobal({ db = null, collection = null, getDocs = null, query = null, where = null, forceRefresh = false } = {}) {
    if (!forceRefresh && cachedHistoricalIndex && Date.now() - cachedHistoricalTimestamp < 5 * 60 * 1000) {
        return cachedHistoricalIndex;
    }

    const idx = crearEntradaIndiceVacia();

    // 1. Cargar en paralelo JSONs estáticos (Scouting 1, Scouting 2, Open Qualifier) + Scouting 3 API
    const fetchJsonSafe = async (url) => {
        try {
            const r = await fetch(url);
            return r.ok ? await r.json() : [];
        } catch (_) {
            return [];
        }
    };

    const fetchScouting3Safe = async () => {
        try {
            const cachedSc3 = localStorage.getItem('lbl_scouting_equipos_cache');
            if (cachedSc3 && !forceRefresh) {
                const parsed = JSON.parse(cachedSc3);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) {}
        try {
            const sep = SCOUTING3_OFFICIAL_API_URL.includes('?') ? '&' : '?';
            const r = await fetch(`${SCOUTING3_OFFICIAL_API_URL}${sep}_t=${Date.now()}`);
            if (r.ok) {
                const json = await r.json();
                if (json && Array.isArray(json.equipos) && json.equipos.length > 0) {
                    return json.equipos;
                }
            }
        } catch (_) {}
        try {
            const pubSc3 = localStorage.getItem('lbl_scouting3_public_sanitized_v288');
            if (pubSc3) return JSON.parse(pubSc3);
        } catch (_) {}
        return [];
    };

    const fetchLigaSafe = async () => {
        if (db && collection && getDocs) {
            try {
                const snap = await getDocs(collection(db, 'inscripciones_pendientes'));
                const list = [];
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
                if (list.length > 0) return list;
            } catch (_) {
                if (query && where) {
                    try {
                        const qAceptados = query(collection(db, 'inscripciones_pendientes'), where('estado', '==', 'Aceptado'));
                        const snap = await getDocs(qAceptados);
                        const list = [];
                        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
                        if (list.length > 0) return list;
                    } catch (_) {}
                }
            }
        }
        try {
            const cachedLiga = localStorage.getItem('lbl_equipos_aceptados_cache');
            if (cachedLiga) {
                const parsed = JSON.parse(cachedLiga);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) {}
        return [];
    };

    const [sc1Data, sc2Data, oqData, sc3Data, ligaData] = await Promise.all([
        fetchJsonSafe('/assets/scouting1.json'),
        fetchJsonSafe('/assets/scouting2.json'),
        fetchJsonSafe('/assets/qualifier.json'),
        fetchScouting3Safe(),
        fetchLigaSafe()
    ]);

    indexarJsonScoutingLegacy(idx, sc1Data, 'SC1', 'Scouting 1', 'scouting1');
    indexarJsonScoutingLegacy(idx, sc2Data, 'SC2', 'Scouting 2', 'scouting2');
    indexarJsonScoutingLegacy(idx, oqData, 'OQ', 'Open Qualifier LBL', 'qualifier');
    indexarEquiposScouting3(idx, sc3Data);
    indexarEquiposLigaLBL(idx, ligaData);

    cachedHistoricalIndex = idx;
    cachedHistoricalTimestamp = Date.now();
    return idx;
}

// ============================================================================
// 4. AUDITORÍA FORENSE DE JUGADOR Y EQUIPO (DETECTOR DE SMURFS / ELO > E1)
// ============================================================================

/**
 * Busca todas las apariciones históricas de un jugador en el índice unificado
 * cruzando por C.I., Celular (Whapp), Nombre completo, Riot ID de Torneo, Riot ID Main y Discord.
 */
export function buscarCoincidenciasJugador(jugador, idx) {
    if (!jugador || !idx) return [];

    const ci = extraerCiLimpio(jugador.ci || '');
    const celular = normalizarCelular(jugador.whapp || jugador.tel || jugador.celular || '');
    const nombreNorm = normalizarNombrePersona(jugador.nombre || '');
    const riotTorneoNorm = normalizarRiotId(jugador.riotIdTorneo || jugador.riotId || '');
    const riotMainNorm = normalizarRiotId(jugador.riotIdMain || jugador.cuenta_secundaria?.riotId2 || '');
    const nickTorneo = extraerNickBaseRiot(jugador.riotIdTorneo || jugador.riotId || '');
    const nickMain = extraerNickBaseRiot(jugador.riotIdMain || '');
    const discordNorm = normalizarDiscord(jugador.discord || jugador.discordId || '');

    const mapaMatches = new Map(); // record.id -> { record, razones: Set }

    const addMatch = (rec, razon) => {
        if (!rec) return;
        if (!mapaMatches.has(rec.id)) {
            mapaMatches.set(rec.id, { record: rec, razones: new Set() });
        }
        mapaMatches.get(rec.id).razones.add(razon);
    };

    // 1. Por C.I.
    if (ci && idx.porCi.has(ci)) {
        idx.porCi.get(ci).forEach(r => addMatch(r, `🪪 Mismo C.I. (${ci})`));
    }

    // 2. Por Celular / WhatsApp
    if (celular && idx.porCelular.has(celular)) {
        idx.porCelular.get(celular).forEach(r => addMatch(r, `📱 Mismo Whapp (${celular})`));
    }

    // 3. Por Riot ID Exacto (Torneo o Main)
    if (riotTorneoNorm && idx.porRiotFull.has(riotTorneoNorm)) {
        idx.porRiotFull.get(riotTorneoNorm).forEach(r => addMatch(r, `🎮 Mismo Riot ID (${jugador.riotIdTorneo || jugador.riotId})`));
    }
    if (riotMainNorm && idx.porRiotFull.has(riotMainNorm)) {
        idx.porRiotFull.get(riotMainNorm).forEach(r => addMatch(r, `🎮 Misma Cuenta Main (${jugador.riotIdMain})`));
    }

    // 4. Por Nick Base (sin #TAG, cuando tiene al menos 4 caracteres)
    if (nickTorneo && nickTorneo.length >= 4 && idx.porRiotNick.has(nickTorneo)) {
        idx.porRiotNick.get(nickTorneo).forEach(r => {
            if (r.riot1Norm !== riotTorneoNorm && r.riot2Norm !== riotTorneoNorm) {
                addMatch(r, `🔎 Nick Similar (${r.riotId || r.riotIdMain})`);
            }
        });
    }
    if (nickMain && nickMain.length >= 4 && idx.porRiotNick.has(nickMain)) {
        idx.porRiotNick.get(nickMain).forEach(r => {
            if (r.riot1Norm !== riotMainNorm && r.riot2Norm !== riotMainNorm) {
                addMatch(r, `🔎 Nick Main Similar (${r.riotId || r.riotIdMain})`);
            }
        });
    }

    // 5. Por Discord
    if (discordNorm && idx.porDiscord.has(discordNorm)) {
        idx.porDiscord.get(discordNorm).forEach(r => addMatch(r, `💬 Mismo Discord (${jugador.discord || jugador.discordId})`));
    }

    // 6. Por Nombre Exacto y Similitud de Nombre/Apellidos
    if (nombreNorm && nombreNorm.length >= 5) {
        if (idx.porNombreExacto.has(nombreNorm)) {
            idx.porNombreExacto.get(nombreNorm).forEach(r => addMatch(r, `👤 Mismo Nombre (${r.nombre})`));
        }
        // Búsqueda difusa por intersección de tokens (ej. puso 1 nombre y 2 apellidos vs 2 nombres y 2 apellidos)
        const tokensJug = obtenerTokensNombre(nombreNorm);
        if (tokensJug.length >= 2) {
            for (let i = 0; i < idx.registros.length; i++) {
                const rec = idx.registros[i];
                if (!rec.nombreNorm || mapaMatches.has(rec.id)) continue;
                const cmp = compararNombresPersona(nombreNorm, rec.nombreNorm);
                if (cmp.coincide) {
                    addMatch(rec, `👤 Nombre Coincidente (${rec.nombre})`);
                }
            }
        }
    }

    return Array.from(mapaMatches.values()).map(m => ({
        record: m.record,
        razones: Array.from(m.razones)
    }));
}

/**
 * Audita a un jugador inscrito al Torneo Presencial (Tope Esmeralda 1).
 * Devuelve alertas clasificadas en 'critica' (Rojo), 'observacion' (Amarillo) o 'info' (Azul).
 */
export function auditarJugadorTorneoLan(jugador, idx, todosEquiposTorneo = [], equipoActualId = null) {
    const alertas = [];
    if (!jugador) {
        return { estadoForense: 'limpio', alertas: [], historial: [] };
    }

    const nombre = (jugador.nombre || '').trim();
    const ci = extraerCiLimpio(jugador.ci || '');
    const celular = normalizarCelular(jugador.whapp || jugador.tel || '');
    const riotTorneo = (jugador.riotIdTorneo || jugador.riotId || '').trim();
    const riotMain = (jugador.riotIdMain || '').trim();
    const riotTorneoNorm = normalizarRiotId(riotTorneo);
    const riotMainNorm = normalizarRiotId(riotMain);
    const evalRangoDeclarado = evaluarRangoSoloQ(jugador.rangoMax || jugador.rangoSoloQ || '');

    // 1. Verificar Lista Negra de Baneados
    const sancionMatch = esPersonaBaneada({
        nombre,
        riotId: riotTorneo,
        riotIdMain: riotMain,
        discord: jugador.discord
    });
    if (sancionMatch) {
        alertas.push({
            severidad: 'critica',
            codigo: 'JUGADOR_SANCIONADO',
            titulo: '⛔ JUGADOR EN LISTA DE SANCIONADOS LBL',
            detalle: `Coincide con el registro de sanciones de LBL ("${sancionMatch}").`
        });
    }

    // 2. Verificar Rango Máximo Declarado (> Esmeralda 1)
    if (evalRangoDeclarado.excedeEsmeralda1) {
        alertas.push({
            severidad: 'critica',
            codigo: 'ELO_DECLARADO_EXCEDIDO',
            titulo: `🚨 RANGO DECLARADO SUPERA ESMERALDA 1 (${evalRangoDeclarado.raw})`,
            detalle: `El jugador declaró rango máximo "${evalRangoDeclarado.raw}". El tope estricto del torneo es Esmeralda 1.`
        });
    }

    // 3. Cruzar con las 6 Bases de Datos Históricas
    const coincidencias = buscarCoincidenciasJugador(jugador, idx);

    coincidencias.forEach(({ record, razones }) => {
        const razonesStr = razones.join(' + ');
        let generoAlertaEspecifica = false;

        // 3a. ¿Participó en Liga LBL Tier 1? -> ALERTA ROJA
        if (record.esLigaTier1) {
            generoAlertaEspecifica = true;
            alertas.push({
                severidad: 'critica',
                codigo: 'HISTORIAL_LIGA_TIER1',
                titulo: `🚨 JUGADOR DE LIGA LBL TIER 1 (${record.equipoNombre})`,
                detalle: `Detectado por ${razonesStr} en "${record.equipoNombre}" [${record.fuenteNombre}] con cuenta "${record.riotId || 'S/N'}".`,
                record
            });
        }

        // 3b. ¿Participó en Liga LBL Tier 2? -> ALERTA AMARILLA (Verificar Elo <= Esmeralda 1)
        if (record.esLigaTier2) {
            generoAlertaEspecifica = true;
            alertas.push({
                severidad: 'observacion',
                codigo: 'HISTORIAL_LIGA_TIER2',
                titulo: `⚠️ HISTORIAL EN LIGA LBL TIER 2 (${record.equipoNombre})`,
                detalle: `Detectado por ${razonesStr} en "${record.equipoNombre}" [${record.fuenteNombre}] con cuenta "${record.riotId || 'S/N'}". Verificar que su Elo no supere Esmeralda 1.`,
                record
            });
        }

        // 3c. ¿Su rango histórico en Scouting 1, 2, 3 u Open Qualifier supera Esmeralda 1? -> ALERTA ROJA
        if (record.evalRango && record.evalRango.excedeEsmeralda1) {
            generoAlertaEspecifica = true;
            alertas.push({
                severidad: 'critica',
                codigo: 'ELO_HISTORICO_EXCEDIDO',
                titulo: `🚨 ELO HISTÓRICO SUPERA ESMERALDA 1: ${record.rango} en ${record.fuenteNombre}`,
                detalle: `Coincide por ${razonesStr} con "${record.nombre || record.riotId}" del equipo "${record.equipoNombre}" (${record.fuenteNombre}), donde registró rango "${record.rango}" con la cuenta "${record.riotId}".`,
                record
            });
        }

        // 3d. ¿Misma persona (por C.I., Celular o Nombre) pero inscribió OTRA cuenta de LoL distinta sin declararla? -> POSIBLE SMURF
        const coincidePorIdentidadFisica = razones.some(
            r => r.includes('Mismo C.I.') || r.includes('Mismo Whapp') || r.includes('Mismo Nombre') || r.includes('Nombre Coincidente') || r.includes('Mismo Discord')
        );
        const recRiot1 = record.riot1Norm;
        const recRiot2 = record.riot2Norm;
        const cuentaHistoricaReconocida =
            !recRiot1 ||
            recRiot1 === riotTorneoNorm ||
            recRiot1 === riotMainNorm ||
            (recRiot2 && (recRiot2 === riotTorneoNorm || recRiot2 === riotMainNorm));

        if (coincidePorIdentidadFisica && !cuentaHistoricaReconocida && record.riotId) {
            generoAlertaEspecifica = true;
            const severidadSmurf = record.evalRango?.excedeEsmeralda1 || record.esLigaTier1 ? 'critica' : 'observacion';
            alertas.push({
                severidad: severidadSmurf,
                codigo: 'CUENTA_ALTERNA_DETECTADA',
                titulo: `${severidadSmurf === 'critica' ? '🚨 POSIBLE SMURF' : '⚠️ OTRA CUENTA REGISTRADA'}: ${record.riotId} (${record.fuenteNombre})`,
                detalle: `Por ${razonesStr}, esta persona jugó en "${record.equipoNombre}" (${record.fuenteNombre}) con la cuenta "${record.riotId}" (Rango: ${record.rango}), distinta a la cuenta inscrita hoy ("${riotTorneo}").`,
                record
            });
        }

        // 3e. ¿Misma cuenta Riot ID pero antes pertenecía a OTRO Nombre o C.I.? -> POSIBLE CUENTA PRESTADA / SUPLANTACIÓN
        const coincideSoloPorCuenta = razones.some(r => r.includes('Mismo Riot ID') || r.includes('Misma Cuenta Main'));
        if (coincideSoloPorCuenta && !coincidePorIdentidadFisica) {
            const ciDistinto = Boolean(ci && record.ci && ci !== record.ci);
            const cmpNom = compararNombresPersona(nombre, record.nombre);
            const nombreDistinto = Boolean(nombre && record.nombre && !cmpNom.coincide);
            if (ciDistinto || nombreDistinto) {
                generoAlertaEspecifica = true;
                alertas.push({
                    severidad: 'observacion',
                    codigo: 'POSIBLE_SUPLANTACION_CUENTA',
                    titulo: `⚠️ CUENTA USADA POR OTRA PERSONA EN ${record.fuenteNombre.toUpperCase()}`,
                    detalle: `La cuenta "${record.riotId}" fue registrada en ${record.fuenteNombre} (${record.equipoNombre}) a nombre de "${record.nombre || 'S/N'}"${record.ci ? ` (C.I. ${record.ci})` : ''}, pero hoy la inscribe "${nombre}"${ci ? ` (C.I. ${ci})` : ''}.`,
                    record
                });
            }
        }

        // 3f. Historial previo detectado en cualquier torneo LBL (SC1, SC2, OQ, SC3, Liga) aunque el rango actual declarado sea <= E1
        if (!generoAlertaEspecifica) {
            alertas.push({
                severidad: 'historial',
                codigo: 'HISTORIAL_PREVIO_DETECTADO',
                titulo: `📋 HISTORIAL EN ${record.fuenteNombre.toUpperCase()} (${record.equipoNombre})`,
                detalle: `Coincide por ${razonesStr} con "${record.nombre || record.riotId || 'S/N'}" del equipo "${record.equipoNombre}" [${record.rol || 'Roster'}] • Cuenta: "${record.riotId || 'S/N'}" • Rango histórico: ${record.rango || 'Unranked'}.`,
                record
            });
        }
    });

    // 4. Verificar Duplicidad / Multiequipo dentro del mismo Torneo Presencial
    if (Array.isArray(todosEquiposTorneo) && todosEquiposTorneo.length > 1) {
        todosEquiposTorneo.forEach(otroEq => {
            if (!otroEq || otroEq.id === equipoActualId || String(otroEq.estado || '').toLowerCase() === 'rechazado') return;
            const otrosJugadores = obtenerJugadoresPlanosTorneoLan(otroEq);
            otrosJugadores.forEach(otroJ => {
                const otroCi = extraerCiLimpio(otroJ.ci || '');
                const otroCel = normalizarCelular(otroJ.whapp || '');
                const otroRiot = normalizarRiotId(otroJ.riotIdTorneo || '');
                if (
                    (ci && otroCi && ci === otroCi) ||
                    (celular && otroCel && celular === otroCel) ||
                    (riotTorneoNorm && otroRiot && riotTorneoNorm === otroRiot)
                ) {
                    alertas.push({
                        severidad: 'critica',
                        codigo: 'MULTIEQUIPO_TORNEO_LAN',
                        titulo: `🚨 INSCRITO EN OTRO EQUIPO DE ESTE TORNEO (${otroEq.equipo?.nombre || 'Otro Equipo'})`,
                        detalle: `Aparece también en el equipo "${otroEq.equipo?.nombre}" [${otroEq.equipo?.tag || ''}] (${otroEq.sedeDepartamento || ''}).`
                    });
                }
            });
        });
    }

    const tieneCritica = alertas.some(a => a.severidad === 'critica');
    const tieneObservacion = alertas.some(a => a.severidad === 'observacion');
    const tieneHistorial = alertas.length > 0;
    const estadoForense = tieneCritica ? 'critica' : (tieneObservacion ? 'observacion' : (tieneHistorial ? 'historial' : 'limpio'));

    return {
        estadoForense,
        alertas,
        historial: coincidencias
    };
}

export function obtenerJugadoresPlanosTorneoLan(equipoDoc) {
    const lista = [];
    if (!equipoDoc) return lista;
    if (Array.isArray(equipoDoc.titulares)) {
        equipoDoc.titulares.forEach((t, idx) => {
            if (t && (t.nombre || t.riotIdTorneo || t.ci)) {
                lista.push({ ...t, esTitular: true, slotLabel: t.rolPrincipal || `Titular #${idx + 1}` });
            }
        });
    } else if (equipoDoc.roster && typeof equipoDoc.roster === 'object') {
        ['TOP', 'JG', 'MID', 'ADC', 'SUPP'].forEach(rol => {
            const t = equipoDoc.roster[rol];
            if (t && (t.nombre || t.riotIdTorneo || t.riotId || t.ci)) {
                lista.push({ ...t, esTitular: true, slotLabel: t.rolPrincipal || rol });
            }
        });
    }
    if (Array.isArray(equipoDoc.suplentes)) {
        equipoDoc.suplentes.forEach((s, idx) => {
            if (s && (s.nombre || s.riotIdTorneo || s.ci)) {
                lista.push({ ...s, esTitular: false, slotLabel: `Suplente #${idx + 1} (${s.rolPrincipal || 'SUB'})` });
            }
        });
    }
    return lista;
}

/**
 * Audita un equipo completo inscrito al Torneo Presencial AMQ vs SMOK.
 */
export function auditarEquipoTorneoLan(equipoDoc, idx, todosEquiposTorneo = []) {
    const jugadores = obtenerJugadoresPlanosTorneoLan(equipoDoc);
    let totalCriticas = 0;
    let totalObservaciones = 0;
    let totalHistoriales = 0;
    let totalCoincidencias = 0;
    const alertasEquipo = [];

    // 0. Verificar si el nombre o TAG del equipo está en Lista Negra
    const nombreEqNorm = quitarAcentos((equipoDoc?.equipo?.nombre || '').toLowerCase().trim());
    const tagEqNorm = quitarAcentos((equipoDoc?.equipo?.tag || '').toLowerCase().trim());
    const equipoBaneadoMatch = BANNED_TEAMS.find(bt => {
        const b = quitarAcentos(bt.toLowerCase().trim());
        return nombreEqNorm.includes(b) || (tagEqNorm && tagEqNorm === b);
    });
    if (equipoBaneadoMatch) {
        totalCriticas++;
        alertasEquipo.push({
            id: `${equipoDoc?.id || 'eq'}_BANNED_TEAM`,
            severidad: 'critica',
            codigo: 'EQUIPO_SANCIONADO',
            titulo: `⛔ EQUIPO EN LISTA DE SANCIONADOS LBL ("${equipoBaneadoMatch}")`,
            detalle: `El nombre o TAG del equipo coincide con una organización sancionada en LBL.`,
            jugador: {
                slotLabel: 'EQUIPO',
                nombre: equipoDoc?.equipo?.nombre || 'Equipo',
                riotIdTorneo: `[${equipoDoc?.equipo?.tag || 'LBL'}]`
            }
        });
    }

    // 0b. Verificar si el Representante tiene sanciones o historial (cuando no es uno de los jugadores del roster)
    const rep = equipoDoc?.capitanContacto;
    if (rep && (rep.nombre || rep.ci || rep.whapp || rep.discord)) {
        const repSancion = esPersonaBaneada({ nombre: rep.nombre, discord: rep.discord });
        if (repSancion) {
            totalCriticas++;
            alertasEquipo.push({
                id: `${equipoDoc?.id || 'eq'}_BANNED_REP`,
                severidad: 'critica',
                codigo: 'REPRESENTANTE_SANCIONADO',
                titulo: `⛔ REPRESENTANTE EN LISTA DE SANCIONADOS LBL ("${repSancion}")`,
                detalle: `El representante "${rep.nombre || rep.discord}" coincide con un registro de sanciones LBL.`,
                jugador: {
                    slotLabel: 'REPRESENTANTE',
                    nombre: rep.nombre || 'Representante',
                    ci: rep.ci || '',
                    whapp: rep.whapp || '',
                    discord: rep.discord || ''
                }
            });
        }
        const repCi = extraerCiLimpio(rep.ci || '');
        const repCel = normalizarCelular(rep.whapp || '');
        const repYaEsJugador = jugadores.some(j =>
            (repCi && extraerCiLimpio(j.ci || '') === repCi) ||
            (repCel && normalizarCelular(j.whapp || '') === repCel)
        );
        if (!repYaEsJugador) {
            const auditRep = auditarJugadorTorneoLan({
                nombre: rep.nombre || '',
                ci: rep.ci || '',
                whapp: rep.whapp || '',
                discord: rep.discord || '',
                riotIdTorneo: rep.riotIdTorneo || ''
            }, idx, [], equipoDoc?.id);
            auditRep.alertas.forEach((a, aIdx) => {
                if (a.severidad === 'critica') totalCriticas++;
                else if (a.severidad === 'observacion') totalObservaciones++;
                else totalHistoriales++;
                alertasEquipo.push({
                    id: `${equipoDoc?.id || 'eq'}_REP_${aIdx}_${a.codigo || 'ALERTA'}`,
                    ...a,
                    jugador: {
                        slotLabel: 'REPRESENTANTE',
                        nombre: rep.nombre || 'Representante',
                        ci: rep.ci || '',
                        whapp: rep.whapp || '',
                        discord: rep.discord || '',
                        riotIdTorneo: rep.riotIdTorneo || ''
                    }
                });
            });
        }
    }

    const resultadosJugadores = jugadores.map((j, jIdx) => {
        const audit = auditarJugadorTorneoLan(j, idx, todosEquiposTorneo, equipoDoc?.id);
        totalCriticas += audit.alertas.filter(a => a.severidad === 'critica').length;
        totalObservaciones += audit.alertas.filter(a => a.severidad === 'observacion').length;
        totalHistoriales += audit.alertas.filter(a => a.severidad === 'historial').length;
        totalCoincidencias += audit.historial.length;
        audit.alertas.forEach((a, aIdx) => {
            alertasEquipo.push({
                id: `${equipoDoc?.id || 'eq'}_${jIdx}_${aIdx}_${a.codigo || 'ALERTA'}`,
                ...a,
                jugador: j
            });
        });
        return {
            jugador: j,
            ...audit
        };
    });

    const estadoGlobal = totalCriticas > 0 ? 'critica' : (totalObservaciones > 0 ? 'observacion' : (totalHistoriales > 0 ? 'historial' : 'limpio'));

    return {
        estadoGlobal,
        totalCriticas,
        totalObservaciones,
        totalHistoriales,
        totalCoincidencias,
        alertasEquipo,
        jugadores: resultadosJugadores
    };
}

// ============================================================================
// 5. BUSCADOR FORENSE GLOBAL ("RASTREATOR INSTANTÁNEO" PARA EL STAFF)
// ============================================================================

/**
 * Permite al Staff buscar cualquier número de celular, C.I., nombre, apellido, Riot ID o Discord
 * a través de todas las bases de datos históricas + inscritos actuales del torneo.
 */
export function buscarEnPadronForenseGlobal(rawQuery, idx, equiposTorneoActual = []) {
    if (!rawQuery || !idx) return [];
    const qTrim = String(rawQuery).trim();
    if (qTrim.length < 2) return [];

    const qNorm = quitarAcentos(qTrim.toLowerCase());
    const qTokens = qNorm.split(/\s+/).filter(Boolean);
    const qCel = normalizarCelular(qTrim);
    const qDigits = qTrim.replace(/\D+/g, '');

    const resultados = [];

    // 1. Buscar en el índice histórico (Scouting 1, 2, 3, Qualifier, Liga Tier 1 y Tier 2)
    for (let i = 0; i < idx.registros.length; i++) {
        const rec = idx.registros[i];
        let match = false;
        let tipoMatch = [];

        if (qDigits.length >= 5) {
            if (rec.ci && rec.ci.includes(qDigits)) {
                match = true;
                tipoMatch.push(`C.I. ${rec.ci}`);
            }
            if (rec.celular && (rec.celular.includes(qDigits) || (qCel && rec.celular.includes(qCel)))) {
                match = true;
                tipoMatch.push(`Whapp ${rec.celular}`);
            }
        }

        if (!match) {
            const allTokensFound = qTokens.every(t => rec._searchBlob.includes(t));
            if (allTokensFound) {
                match = true;
                if (rec.riot1Norm.includes(qNorm.replace(/\s+/g, '')) || rec.riot2Norm.includes(qNorm.replace(/\s+/g, ''))) {
                    tipoMatch.push('Riot ID');
                } else if (rec.nombreNorm.includes(qNorm)) {
                    tipoMatch.push('Nombre');
                } else {
                    tipoMatch.push('Coincidencia');
                }
            }
        }

        if (match) {
            resultados.push({
                ...rec,
                tipoMatch: tipoMatch.join(' • ') || 'Coincidencia'
            });
        }
    }

    // 2. Buscar también entre los inscritos actuales del Torneo Presencial AMQ vs SMOK
    if (Array.isArray(equiposTorneoActual)) {
        equiposTorneoActual.forEach(eq => {
            const jugs = obtenerJugadoresPlanosTorneoLan(eq);
            jugs.forEach(j => {
                const blob = quitarAcentos(
                    `${j.nombre || ''} ${j.ci || ''} ${j.whapp || ''} ${j.riotIdTorneo || ''} ${j.riotIdMain || ''} ${j.discord || ''} ${eq.equipo?.nombre || ''} ${eq.equipo?.tag || ''}`
                        .toLowerCase()
                );
                const celJ = normalizarCelular(j.whapp || '');
                const ciJ = extraerCiLimpio(j.ci || '');

                let match = false;
                if (qDigits.length >= 5 && ((ciJ && ciJ.includes(qDigits)) || (celJ && celJ.includes(qDigits)))) {
                    match = true;
                } else if (qTokens.every(t => blob.includes(t))) {
                    match = true;
                }

                if (match) {
                    const evalR = evaluarRangoSoloQ(j.rangoMax || 'Unranked');
                    resultados.unshift({
                        id: `TORNEO_LAN_${eq.id}_${j.rolPrincipal || 'J'}`,
                        fuenteCodigo: 'TORNEO_LAN',
                        fuenteNombre: `Torneo LAN (${eq.sedeDepartamento || 'Inscrito'})`,
                        equipoNombre: eq.equipo?.nombre || 'Equipo Torneo',
                        equipoTag: eq.equipo?.tag || '',
                        equipoEstado: eq.estado || 'Pendiente',
                        rol: `${j.rolPrincipal || 'Titular'}${j.rolSecundario ? ` / ${j.rolSecundario}` : ''}`,
                        nombre: j.nombre || '',
                        ci: ciJ,
                        celular: celJ,
                        discord: j.discord || '',
                        riotId: j.riotIdTorneo || '',
                        riotIdMain: j.riotIdMain || '',
                        regionMain: j.riotIdMain ? resolverRegionMainJugador(j) : '',
                        opgg: j.opggTorneo || construirUrlOpgg(j.riotIdTorneo),
                        opggMain: resolverUrlOpggMainJugador(j),
                        rango: j.rangoMax || 'Unranked',
                        evalRango: evalR,
                        tipoMatch: 'Inscrito Torneo Actual'
                    });
                }
            });
        });
    }

    return resultados.slice(0, 120);
}

// ============================================================================
// 6. SANITIZADOR ESTRICTO PARA VITRINA PÚBLICA (CERO C.I., NOMBRES O CELULARES)
// ============================================================================

export function sanitizarEquipoTorneoLanPublico(rawDoc) {
    if (!rawDoc) return null;
    const estado = String(rawDoc.estado || 'Pendiente').trim();
    if (estado.toLowerCase() !== 'aceptado') return null;

    const sanitizarJugadorPublico = (j) => {
        if (!j) return null;
        const rTorneo = String(j.riotIdTorneo || j.riotId || '').trim();
        const rMain = String(j.riotIdMain || '').trim();
        const tieneMainDistinta = Boolean(
            rMain &&
            !IGNORE_RIOT_VALUES.has(rMain.toLowerCase()) &&
            normalizarRiotId(rMain) !== normalizarRiotId(rTorneo)
        );
        const regionMainResuelta = tieneMainDistinta ? resolverRegionMainJugador(j) : '';
        return {
            riotIdTorneo: rTorneo || 'Jugador',
            opggTorneo: j.opggTorneo || construirUrlOpgg(rTorneo),
            riotIdMain: tieneMainDistinta ? rMain : '',
            regionMain: regionMainResuelta,
            opggMain: tieneMainDistinta ? resolverUrlOpggMainJugador(j) : '',
            rolPrincipal: String(j.rolPrincipal || 'TITULAR').toUpperCase(),
            rolSecundario: String(j.rolSecundario || 'Polivalente'),
            rangoMax: String(j.rangoMax || 'Esmeralda 1'),
            esCapitan: Boolean(j.esCapitan)
        };
    };

    const titulares = Array.isArray(rawDoc.titulares)
        ? rawDoc.titulares.map(sanitizarJugadorPublico).filter(Boolean)
        : [];
    const suplentes = Array.isArray(rawDoc.suplentes)
        ? rawDoc.suplentes.map(sanitizarJugadorPublico).filter(Boolean)
        : [];

    return {
        id: rawDoc.id || '',
        torneoId: rawDoc.torneoId || TORNEO_LAN_ID,
        sedeDepartamento: rawDoc.sedeDepartamento || 'La Paz',
        sedeSponsor: rawDoc.sedeDepartamento === 'Cochabamba' ? 'SMOK LAN CENTER' : 'Aquí Me Quedo',
        estado: 'Aceptado',
        approvedAt: rawDoc.approvedAt || rawDoc.updatedAt || rawDoc.timestamp || new Date().toISOString(),
        equipo: {
            nombre: String(rawDoc.equipo?.nombre || 'Equipo Confirmado').trim(),
            tag: String(rawDoc.equipo?.tag || 'LBL').trim().toUpperCase(),
            logo: String(rawDoc.equipo?.logo || '/assets/logo.webp').trim()
        },
        titulares,
        suplentes
    };
}
