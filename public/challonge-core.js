/**
 * ==============================================================================
 * MOTOR CORE DE INTEGRACIÓN Y SINCRONIZACIÓN CON CHALLONGE API (LBL ESPORTS)
 * ==============================================================================
 * 
 * Funcionalidad:
 * 1. Consultar torneo y partidas mediante la API de Challonge.
 * 2. Detectar automáticamente el formato (Round Robin / Grupos vs Eliminatoria Directa / Doble).
 * 3. Mapear los equipos de Challonge con la base de datos de Firestore (Logos HD, Rosters, TAGs).
 * 4. Generar la estructura de datos lista para publicar en `torneos_activos`.
 */

export const DEFAULT_CHALLONGE_API_KEY = '62dfc5ae3c0cd785b41ff82a0b4dc5465146abdf701892c8';

// Directorio oficial de respaldo para Logos HD de Equipos LBL
export const OFFICIAL_LBL_TEAM_LOGOS = {
    'kaox pink':          { nombre: 'Kaox Pink', tag: 'KPK', logo: 'https://i.ibb.co/ccDss4cK/kaox-pink.png', tier: 'Tier 2' },
    'marines del altiplano': { nombre: 'MARINES DEL ALTIPLANO', tag: 'MDA', logo: 'https://i.ibb.co/5g3pWqCY/MDA-nuevo.png', tier: 'Tier 2' },
    'uka kitties':        { nombre: 'Uka Kitties', tag: 'UKAT', logo: 'https://i.ibb.co/BVs51DdC/ukakitties.png', tier: 'Tier 1' },
    'kaox red':           { nombre: 'Kaox Red', tag: 'KXRED', logo: 'https://i.ibb.co/nqkx7WDb/Red.png', tier: 'Tier 1' },
    'mapaches apaches':   { nombre: 'Mapaches Apaches', tag: 'MAP', logo: 'https://i.ibb.co/qFXxj74Y/mapaches-apaches.png', tier: 'Tier 1' },
    'kaox yellow':        { nombre: 'Kaox Yellow', tag: 'KXY', logo: 'https://i.ibb.co/cKLS7ML6/Yellow.png', tier: 'Tier 2' },
    'strugglers e-sports':{ nombre: 'STRUGGLERS E-SPORTS', tag: 'SGE', logo: 'https://i.ibb.co/HJPtTY2/SGE-LOGO2.png', tier: 'Tier 1' },
    'team first kill':    { nombre: 'Team First Kill', tag: 'TFK', logo: 'https://i.ibb.co/yFJf62yw/first-kill.png', tier: 'Tier 2' },
    'aether core academy':{ nombre: 'Aether Core Academy', tag: 'ATA', logo: 'https://i.ibb.co/mFCWgPLq/aether-core-academy.png', tier: 'Tier 2' },
    'kaox green':         { nombre: 'Kaox Green', tag: 'KXG', logo: 'https://i.ibb.co/SHV7G65/Green.png', tier: 'Tier 2' },
    'quinteto de nos':    { nombre: 'Quinteto de nos', tag: 'QDN', logo: 'https://i.ibb.co/99mnBtnx/QUINTETO-DE-NOS.png', tier: 'Tier 2' },
    't1nacotas':          { nombre: 'T1NACOTAS', tag: 'T1N', logo: 'https://i.ibb.co/84B0WzY7/T1-NACOTAS.png', tier: 'Tier 2' },
    'crimson weasels':    { nombre: 'Crimson Weasels', tag: 'CRW', logo: 'https://i.ibb.co/xtnyLw23/CRIMSON-WEASELS.png', tier: 'Tier 2' },
    'grieta cumbiera':    { nombre: 'Grieta Cumbiera', tag: 'GRC', logo: 'https://i.ibb.co/LdVwgvQ3/Grieta-Cumbiera.png', tier: 'Tier 1' },
    'team dark':          { nombre: 'TEAM DARK', tag: 'TDK', logo: 'https://i.ibb.co/CKK956Sh/team-dark-4.png', tier: 'Tier 1' },
    'snake dynasty':      { nombre: 'Snake Dynasty', tag: 'SKD', logo: 'https://i.ibb.co/Fqy1YXJ0/snake-dinasty-2.png', tier: 'Tier 2' },
    'rise of kings order':{ nombre: 'Rise Of Kings Order', tag: 'RKO', logo: 'https://i.ibb.co/pjkrMcp2/Rise-Of-King-Order.png', tier: 'Tier 2' },
    'aether core':        { nombre: 'Aether Core', tag: 'ATC', logo: 'https://i.ibb.co/RkS1hdyG/ATC-no-bg.png', tier: 'Tier 1' },
    'condor nexus':       { nombre: 'CONDOR NEXUS', tag: 'CRN', logo: 'https://i.ibb.co/YB1TM3GT/condor-nexus.png', tier: 'Tier 2' },
    'riot pls game':      { nombre: 'RIOT PLS GAME', tag: 'RPG', logo: 'https://i.ibb.co/21yW1QxC/riot-plis.png', tier: 'Tier 1' }
};

/**
 * Mapea el TAG o Nombre de Challonge con la colección de equipos LBL de Firestore.
 */
export function buscarEquipoLBL(participantName, equiposLBL = []) {
    if (!participantName) return null;
    const cleanName = participantName.toString().trim().toLowerCase();

    let equiposLista = Array.isArray(equiposLBL) && equiposLBL.length > 0 ? equiposLBL : [];
    if (equiposLista.length === 0 && typeof localStorage !== 'undefined') {
        try {
            const cached = localStorage.getItem('lbl_equipos_aceptados_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) equiposLista = parsed;
            }
        } catch(e) {}
    }
    
    // 1. Coincidencia EXACTA por TAG
    let hallado = equiposLista.find(eq => {
        const tag = (eq.equipo?.tag || '').trim().toLowerCase();
        return tag && tag === cleanName;
    });

    // 2. Coincidencia EXACTA por Nombre
    if (!hallado) {
        hallado = equiposLista.find(eq => {
            const nom = (eq.equipo?.nombre || '').trim().toLowerCase();
            return nom && nom === cleanName;
        });
    }

    // 3. Coincidencia parcial estricta (no mezclar divisiones principal vs academy)
    if (!hallado) {
        hallado = equiposLista.find(eq => {
            const nom = (eq.equipo?.nombre || '').trim().toLowerCase();
            if (cleanName === 'aether core' && nom.includes('academy')) return false;
            if (cleanName.includes('academy') && !nom.includes('academy')) return false;
            return nom && (nom.startsWith(cleanName) || cleanName.startsWith(nom));
        });
    }

    if (hallado) {
        return {
            id: hallado.id,
            nombre: hallado.equipo?.nombre || participantName,
            tag: hallado.equipo?.tag || participantName,
            logo: hallado.equipo?.logo || '',
            tier: hallado.equipo?.tier || 'Tier 2'
        };
    }

    // 4. Búsqueda en Directorio Oficial de Respaldo LBL
    const fallbackKey = Object.keys(OFFICIAL_LBL_TEAM_LOGOS).find(k => {
        if (cleanName === 'aether core' && k.includes('academy')) return false;
        if (cleanName.includes('academy') && !k.includes('academy')) return false;
        return k === cleanName || cleanName.startsWith(k) || k.startsWith(cleanName);
    });

    if (fallbackKey && OFFICIAL_LBL_TEAM_LOGOS[fallbackKey]) {
        const fb = OFFICIAL_LBL_TEAM_LOGOS[fallbackKey];
        return {
            id: `lbl_${fallbackKey.replace(/\s+/g, '_')}`,
            nombre: fb.nombre || participantName,
            tag: fb.tag || participantName,
            logo: fb.logo || '',
            tier: fb.tier || 'Tier 2'
        };
    }

    return {
        id: `custom_${cleanName}`,
        nombre: participantName,
        tag: participantName,
        logo: '',
        tier: 'Invitado'
    };
}

/**
 * Parsea y calcula la tabla de posiciones para torneos formato Round Robin / Fase de Grupos
 */
export function calcularTablaRoundRobin(participantsMap, matches) {
    const tabla = {};

    Object.keys(participantsMap).forEach(partId => {
        const part = participantsMap[partId];
        if (part && !tabla[part.id]) {
            tabla[part.id] = {
                id: part.id,
                equipo: part.lblInfo || { nombre: part.name, tag: part.name, logo: '' },
                pj: 0, pg: 0, pp: 0, pts: 0, diferencia: 0
            };
        }
    });

    matches.forEach(m => {
        if (m.state !== 'complete' || !m.winner_id || !m.scores_csv) return;
        const p1 = participantsMap[m.player1_id];
        const p2 = participantsMap[m.player2_id];
        if (!p1 || !p2) return;

        const p1Key = p1.id;
        const p2Key = p2.id;
        if (!tabla[p1Key] || !tabla[p2Key]) return;

        const scores = m.scores_csv.split('-').map(s => parseInt(s.trim()) || 0);
        const p1Score = scores[0] || 0;
        const p2Score = scores[1] || 0;

        tabla[p1Key].pj += 1;
        tabla[p2Key].pj += 1;

        const winnerPart = participantsMap[m.winner_id];
        if (winnerPart && winnerPart.id === p1Key) {
            tabla[p1Key].pg += 1;
            tabla[p1Key].pts += 3;
            tabla[p2Key].pp += 1;
        } else if (winnerPart && winnerPart.id === p2Key) {
            tabla[p2Key].pg += 1;
            tabla[p2Key].pts += 3;
            tabla[p1Key].pp += 1;
        }

        tabla[p1Key].diferencia += (p1Score - p2Score);
        tabla[p2Key].diferencia += (p2Score - p1Score);
    });

    return Object.values(tabla).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
        return b.pg - a.pg;
    });
}

/**
 * Extrae limpiamente el slug o ID de un torneo desde cualquier URL o texto de Challonge.
 */
export function extraerChallongeSlug(inputStr) {
    if (!inputStr) return '';
    let str = inputStr.trim();
    str = str.replace(/^https?:\/\//i, '');
    str = str.replace(/^(?:[a-zA-Z0-9-]+\.)?challonge\.com\//i, '');
    str = str.replace(/^(?:es|en|pt|fr|de|it|ja)\//i, '');
    return str.split('/')[0].split('?')[0].trim();
}

/**
 * Helper centralizado de peticiones con fallback de proxies CORS para navegadores.
 */
async function apiCall(targetUrl) {
    // 1. Petición directa oficial a Challonge API
    try {
        const res = await fetch(targetUrl);
        if (res.ok) return await res.json();
    } catch(e) {}

    // 2. Fallback secundario silencioso si se requiere proxy
    try {
        const corsUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(corsUrl);
        if (res.ok) return await res.json();
    } catch(e) {}

    return null;
}

/**
 * Lista todos los torneos de la cuenta de Challonge asociada a la API Key.
 */
export async function obtenerListaTorneosChallonge(apiKey = DEFAULT_CHALLONGE_API_KEY) {
    const cleanKey = (apiKey || DEFAULT_CHALLONGE_API_KEY).trim();
    if (!cleanKey) return [];

    const targetUrl = `https://api.challonge.com/v1/tournaments.json?api_key=${encodeURIComponent(cleanKey)}`;
    const data = await apiCall(targetUrl);
    if (Array.isArray(data)) {
        return data.map(item => item.tournament).filter(Boolean);
    }
    return [];
}

/**
 * Resuelve un slug/URL/nombre a un ID numérico de Challonge buscando en la lista de la cuenta.
 */
async function resolverTorneoANumericId(inputSlug, apiKey) {
    const listData = await obtenerListaTorneosChallonge(apiKey);
    if (!Array.isArray(listData) || listData.length === 0) return null;

    const qClean = inputSlug.toLowerCase().replace(/[^a-z0-9]/g, '');

    let target = listData.find(t => t.id && t.id.toString() === inputSlug);

    if (!target) {
        target = listData.find(t => t.url && t.url.toLowerCase() === inputSlug.toLowerCase());
    }

    if (!target) {
        target = listData.find(t => {
            const u = (t.url || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return u === qClean;
        });
    }

    if (!target) {
        target = listData.find(t => {
            const u = (t.url || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return u.includes(qClean) || qClean.includes(u);
        });
    }

    if (!target) {
        target = listData.find(t => {
            const n = (t.name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
            const q = inputSlug.toLowerCase().replace(/[^a-z0-9 ]/g, '');
            if (n.includes(q) || q.includes(n)) return true;
            const words = q.split(/\s+/).filter(w => w.length > 2);
            if (words.length > 0 && words.every(w => n.includes(w))) return true;
            return false;
        });
    }

    if (target && target.id) {
        return { id: target.id, tournament: target };
    }
    return null;
}

/**
 * Consulta la API de Challonge v1 y construye la estructura completa del torneo.
 */
export async function procesarTorneoChallonge(tournamentSlugOrId, apiKey = DEFAULT_CHALLONGE_API_KEY, equiposLBL = [], tierLabel = 'Tier 1') {
    const cleanKey = (apiKey || DEFAULT_CHALLONGE_API_KEY).trim();
    if (!tournamentSlugOrId || !cleanKey) {
        throw new Error("Se requiere el ID o URL del Torneo y la API Key de Challonge.");
    }

    const cleanSlug = extraerChallongeSlug(tournamentSlugOrId);
    if (!cleanSlug) {
        throw new Error("ID o URL de torneo no válido.");
    }

    let data = null;

    const resolved = await resolverTorneoANumericId(cleanSlug, cleanKey);
    if (resolved) {
        const fullUrl = `https://api.challonge.com/v1/tournaments/${resolved.id}.json?api_key=${encodeURIComponent(cleanKey)}&include_participants=1&include_matches=1`;
        data = await apiCall(fullUrl);
    }

    if (!data || !data.tournament) {
        const directUrl = `https://api.challonge.com/v1/tournaments/${cleanSlug}.json?api_key=${encodeURIComponent(cleanKey)}&include_participants=1&include_matches=1`;
        data = await apiCall(directUrl);
    }

    if (!data || !data.tournament) {
        // Fallback inteligente para torneos públicos alojados en cualquier cuenta u organización de Challonge
        if (cleanSlug && cleanSlug.length >= 3) {
            console.warn(`Torneo ${cleanSlug} no pertenece a la API Key principal. Generando estructura de integración embed por URL pública.`);
            return {
                id: cleanSlug.toLowerCase(),
                slug: cleanSlug,
                nombre: cleanSlug.toUpperCase() === 'WC2026LBL' ? 'Winter Cup LBL 2026' : (cleanSlug.toUpperCase()),
                tipoFormat: 'single_elimination',
                tier: tierLabel || 'General',
                categoria: 'abierto',
                division: tierLabel || 'General',
                formatoType: 'single_elimination',
                formatoLabel: 'Eliminatoria Directa',
                estado: 'complete',
                isFallback: true,
                totalEquipos: 0,
                actualizadoEn: new Date().toISOString(),
                urlChallonge: `https://challonge.com/es/${cleanSlug}`,
                embedUrl: `https://challonge.com/es/${cleanSlug}/module`,
                equiposMap: {},
                participantes: [],
                matches: [],
                standings: [],
                challongeStandings: [],
                podio: { primerLugar: null, segundoLugar: null, tercerLugar: null },
                creadoEn: new Date().toISOString()
            };
        }
        throw new Error(
            `No se encontró el torneo "${cleanSlug}" en tu cuenta de Challonge.\n` +
            `Verifica que el torneo pertenezca a tu cuenta o usa el selector "Importar desde mi Cuenta Challonge".`
        );
    }

    const tData = data.tournament;
    const tournamentType = (tData.tournament_type || 'single_elimination').toLowerCase();

    // 1. Participantes únicos (sin duplicados por group_player_ids)
    const listaParticipantesUnicos = Array.isArray(tData.participants)
        ? tData.participants.map(item => {
            const p = item.participant;
            const pName = p.name || p.display_name || 'Equipo';
            return {
                id: p.id,
                name: pName,
                seed: p.seed,
                final_rank: (p.final_rank !== null && p.final_rank !== undefined) ? parseInt(p.final_rank) : null,
                group_player_ids: Array.isArray(p.group_player_ids) ? p.group_player_ids : [],
                lblInfo: buscarEquipoLBL(pName, equiposLBL)
            };
        })
        : [];

    // Mapa completo de participantes (incluyendo alias de grupos para lookup de partidas)
    const participantsMap = {};
    listaParticipantesUnicos.forEach(pObj => {
        participantsMap[pObj.id] = pObj;
        pObj.group_player_ids.forEach(gId => {
            participantsMap[gId] = pObj;
        });
    });

    // 2. Mapear partidas
    const rawMatches = Array.isArray(tData.matches) ? tData.matches : [];
    const matchesProcesadas = rawMatches.map(item => {
        const m = item.match;
        const p1 = participantsMap[m.player1_id] || null;
        const p2 = participantsMap[m.player2_id] || null;

        let estado = 'pending';
        if (m.state === 'complete') estado = 'completed';
        else if (m.underway_at) estado = 'live';

        return {
            id: m.id,
            round: m.round,
            identifier: m.identifier,
            group_id: m.group_id ?? null,
            state: estado,
            scores_csv: m.scores_csv || '0-0',
            winner_id: m.winner_id,
            player1_id: m.player1_id,
            player2_id: m.player2_id,
            player1_prereq_match_id: m.player1_prereq_match_id,
            player2_prereq_match_id: m.player2_prereq_match_id,
            player1: p1 ? p1.lblInfo : { nombre: 'TBD', tag: 'TBD', logo: '' },
            player2: p2 ? p2.lblInfo : { nombre: 'TBD', tag: 'TBD', logo: '' },
            scheduled_time: m.scheduled_time || null,
            underway_at: m.underway_at || null,
            completed_at: m.completed_at || null,
            updated_at: m.updated_at
        };
    });

    // 3. Calcular la tabla de posiciones si es Round Robin
    let tablaStandings = [];
    if (tournamentType.includes('round') || tournamentType.includes('group')) {
        tablaStandings = calcularTablaRoundRobin(participantsMap, rawMatches.map(m => m.match));
    }

    // 4. Construir standings oficiales de Challonge usando final_rank DIRECTAMENTE sobre participantes únicos
    const challongeStandings = listaParticipantesUnicos
        .filter(p => p.final_rank !== null && p.final_rank !== undefined)
        .sort((a, b) => a.final_rank - b.final_rank)
        .map(p => ({
            rank: p.final_rank,
            equipo: p.lblInfo || { nombre: p.name, tag: p.name, logo: '' },
            equipo_id: p.id,
            participant_id: p.id,
            group_player_ids: p.group_player_ids
        }));

    // 5. Calcular Podio oficial
    const podio = calcularPodio(tData, matchesProcesadas, tablaStandings, participantsMap, listaParticipantesUnicos);

    return {
        id: tData.id,
        slug: tData.url,
        nombre: tData.name,
        tipoFormat: tournamentType,
        tier: tierLabel,
        estado: tData.state,
        totalEquipos: tData.participants_count || listaParticipantesUnicos.length,
        actualizadoEn: new Date().toISOString(),
        participantes: listaParticipantesUnicos,
        matches: matchesProcesadas,
        standings: tablaStandings,
        challongeStandings: challongeStandings,
        podio: podio
    };
}

/**
 * Calcula los primeros 3 lugares oficiales del torneo (1º, 2º y 3º lugar sin duplicados).
 */
export function calcularPodio(tData, matches, standings = [], participantsMap = {}, listaParticipantes = []) {
    // 1. PRIORIDAD MÁXIMA: Ranking oficial de Challonge (final_rank)
    if (Array.isArray(listaParticipantes) && listaParticipantes.length > 0) {
        const r1 = listaParticipantes.find(p => p.final_rank === 1);
        const r2 = listaParticipantes.find(p => p.final_rank === 2);
        const r3 = listaParticipantes.find(p => p.final_rank === 3);

        if (r1) {
            return {
                primerLugar: r1.lblInfo || { nombre: r1.name, tag: r1.name, logo: '' },
                segundoLugar: r2 ? (r2.lblInfo || { nombre: r2.name, tag: r2.name, logo: '' }) : null,
                tercerLugar: r3 ? (r3.lblInfo || { nombre: r3.name, tag: r3.name, logo: '' }) : null
            };
        }
    }

    // 2. Standings de Fase de Grupos / Round Robin
    if (standings && standings.length >= 3) {
        return {
            primerLugar: standings[0]?.equipo || null,
            segundoLugar: standings[1]?.equipo || null,
            tercerLugar: standings[2]?.equipo || null
        };
    }

    if (!matches || matches.length === 0) {
        return { primerLugar: null, segundoLugar: null, tercerLugar: null };
    }

    // 3. Bracket / Eliminatorias (Doble o Simple)
    const positiveMatches = matches.filter(m => m.round > 0).sort((a, b) => b.round - a.round);
    const granFinal = positiveMatches[0] || null;

    let primerLugar = null;
    let segundoLugar = null;
    let tercerLugar = null;

    if (granFinal && granFinal.winner_id && (granFinal.state === 'completed' || granFinal.state === 'complete')) {
        if (String(granFinal.winner_id) === String(granFinal.player1_id)) {
            primerLugar = granFinal.player1;
            segundoLugar = granFinal.player2;
        } else {
            primerLugar = granFinal.player2;
            segundoLugar = granFinal.player1;
        }
    }

    // Buscar 3er lugar (Perdedor de la Final de Perdedores en Doble Eliminatoria)
    const negativeMatches = matches.filter(m => m.round < 0).sort((a, b) => a.round - b.round);
    const losersFinal = negativeMatches[0] || null;

    if (losersFinal && losersFinal.winner_id && (losersFinal.state === 'completed' || losersFinal.state === 'complete')) {
        if (String(losersFinal.winner_id) === String(losersFinal.player1_id)) {
            tercerLugar = losersFinal.player2;
        } else {
            tercerLugar = losersFinal.player1;
        }
    } else {
        // En eliminación simple, buscar semifinalistas perdedores que NO sean el 1° ni el 2°
        const semifinalMatches = positiveMatches.filter(m => m.round === (granFinal ? granFinal.round - 1 : 1));
        for (const semi of semifinalMatches) {
            if (semi && semi.winner_id) {
                const loser = String(semi.winner_id) === String(semi.player1_id) ? semi.player2 : semi.player1;
                const loserName = loser?.nombre || loser?.name;
                const p1Name = primerLugar?.nombre || primerLugar?.name;
                const p2Name = segundoLugar?.nombre || segundoLugar?.name;
                if (loserName && loserName !== p1Name && loserName !== p2Name) {
                    tercerLugar = loser;
                    break;
                }
            }
        }
    }

    return { primerLugar, segundoLugar, tercerLugar };
}
