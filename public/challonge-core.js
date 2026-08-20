/**
 * ==============================================================================
 * MOTOR CORE DE INTEGRACIÓN Y SINCRONIZACIÓN CON CHALLONGE API (LBL ESPORTS)
 * ==============================================================================
 * 
 * Funcionalidad:
 * 1. Consultar torneo y partidas mediante la API de Challonge (Pool de 2 API Keys = 1,000 req/mes).
 * 2. 1 sola petición directa por torneo (?include_participants=1&include_matches=1).
 * 3. Auto-Sync Adaptativo Inteligente por Día de la Semana (Jue-Dom: 10 min | Lun-Mié: 45 min).
 * 4. Tolerancia a fallos con AbortController de 4.5s (Cero congelamientos de navegador).
 * 5. Mapear equipos con Firestore (Logos HD, Rosters, TAGs, Podios y Standings).
 */

// POOL MULTI-KEY OFICIAL LBL (1,000 requests/mes combinados)
export const CHALLONGE_API_KEYS = [
    '62dfc5ae3c0cd785b41ff82a0b4dc5465146abdf701892c8', // Llave 1: LBL Principal (500 req/mes)
    '76b119b0d4615733e9e72e3b628f515551ba710deeb64f5b'  // Llave 2: LBL Backup (500 req/mes)
];

export const DEFAULT_CHALLONGE_API_KEY = CHALLONGE_API_KEYS[0];

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
 * Limpia y extrae el identificador/slug de Challonge
 */
export function extraerChallongeSlug(urlOrSlug) {
    if (!urlOrSlug) return '';
    let str = urlOrSlug.toString().trim();
    str = str.replace(/^https?:\/\//i, '');
    str = str.replace(/^(?:[a-zA-Z0-9-]+\.)?challonge\.com\//i, '');
    str = str.replace(/^(?:es|en|pt|fr|de|it|ja)\//i, '');
    return str.split('/')[0].split('?')[0].trim();
}

/**
 * Fetch con AbortController para evitar congelamientos de pantalla.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return response;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

/**
 * Helper centralizado con Failover automático de Multi-Keys y Proxies rápidos.
 */
async function apiCall(endpointPath, preferredApiKey = null) {
    const keysToTry = preferredApiKey 
        ? [preferredApiKey, ...CHALLONGE_API_KEYS.filter(k => k !== preferredApiKey)]
        : [...CHALLONGE_API_KEYS];

    for (const key of keysToTry) {
        const cleanKey = (key || '').trim();
        if (!cleanKey) continue;

        const separator = endpointPath.includes('?') ? '&' : '?';
        const targetUrl = `https://api.challonge.com/v1/${endpointPath}${separator}api_key=${encodeURIComponent(cleanKey)}`;

        // Proxies en orden de velocidad y estabilidad comprobada
        const proxyList = [
            `https://proxy.cors.sh/${targetUrl}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
            targetUrl // Intento directo
        ];

        for (const pUrl of proxyList) {
            try {
                const res = await fetchWithTimeout(pUrl, {}, 4000);
                if (res.ok) {
                    const parsed = await res.json();
                    if (parsed && (parsed.tournament || Array.isArray(parsed))) {
                        return { data: parsed, keyUsed: cleanKey };
                    }
                }
            } catch (e) {
                // Timeout o CORS error en este proxy -> intentar el siguiente sin congelar
            }
        }
    }

    return null;
}

/**
 * Lista todos los torneos de la cuenta de Challonge (Solo bajo demanda explícita).
 */
export async function obtenerListaTorneosChallonge(apiKey = null) {
    const result = await apiCall('tournaments.json', apiKey);
    if (result && Array.isArray(result.data)) {
        return result.data.map(item => item.tournament).filter(Boolean);
    }
    return [];
}

/**
 * Resuelve un slug a ID solo si no es numérico y como fallback de emergencia.
 */
async function resolverTorneoANumericId(inputSlug, apiKey) {
    const listData = await obtenerListaTorneosChallonge(apiKey);
    if (!Array.isArray(listData) || listData.length === 0) return null;

    const qClean = inputSlug.toLowerCase().replace(/[^a-z0-9]/g, '');

    let target = listData.find(t => t.id && t.id.toString() === inputSlug);
    if (!target) target = listData.find(t => t.url && t.url.toLowerCase() === inputSlug.toLowerCase());
    if (!target) target = listData.find(t => (t.url || '').toLowerCase().replace(/[^a-z0-9]/g, '') === qClean);

    if (target && target.id) {
        return { id: target.id, tournament: target };
    }
    return null;
}

/**
 * Consulta la API de Challonge v1 y construye la estructura completa en 1 SOLA llamada limpia.
 */
export async function procesarTorneoChallonge(tournamentSlugOrId, apiKey = null, equiposLBL = [], tierLabel = 'Tier 1') {
    if (!tournamentSlugOrId) {
        throw new Error("Se requiere el ID o URL del Torneo.");
    }

    const cleanSlug = extraerChallongeSlug(tournamentSlugOrId);
    if (!cleanSlug) {
        throw new Error("ID o URL de torneo no válido.");
    }

    let payload = null;
    let keyUsada = null;

    // 1. INTENTO DIRECTO EN 1 SOLA LLAMADA (Prioridad por ID numérico o Slug)
    const directPath = `tournaments/${encodeURIComponent(cleanSlug)}.json?include_participants=1&include_matches=1`;
    const directRes = await apiCall(directPath, apiKey);
    if (directRes && directRes.data && directRes.data.tournament) {
        payload = directRes.data;
        keyUsada = directRes.keyUsed;
    }

    // 2. FALLBACK DE RESOLUCIÓN SOLO SI EL INTENTO DIRECTO FALLÓ
    if (!payload) {
        const resolved = await resolverTorneoANumericId(cleanSlug, apiKey);
        if (resolved && resolved.id) {
            const res2 = await apiCall(`tournaments/${resolved.id}.json?include_participants=1&include_matches=1`, apiKey);
            if (res2 && res2.data && res2.data.tournament) {
                payload = res2.data;
                keyUsada = res2.keyUsed;
            }
        }
    }

    if (!payload || !payload.tournament) {
        throw new Error(
            `No se pudo consultar el torneo "${cleanSlug}" con la API de Challonge.\n` +
            `Verifica el ID/enlace o que los proxies de red tengan conexión.`
        );
    }

    const tData = payload.tournament;
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

    // Mapa completo de participantes
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

    // 4. Standings oficiales de Challonge usando final_rank
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
        podio: podio,
        keyUsed: keyUsada
    };
}

/**
 * Calcula el tiempo de Cooldown inteligente según el día de la semana.
 * - Jueves a Domingo (Días de Torneo): 10 minutos
 * - Lunes a Miércoles (Días de Semana / Reprogramaciones): 45 minutos
 */
export function obtenerCooldownRecomendadoMs() {
    const dia = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ..., 4 = Jueves, 5 = Viernes, 6 = Sábado
    const esDiaTorneo = (dia === 0 || dia >= 4);
    return esDiaTorneo ? (10 * 60 * 1000) : (45 * 60 * 1000);
}

/**
 * Helper de Auto-Sincronización Silenciosa para torneos activos.
 * Solo ejecuta si el torneo está activo y ha transcurrido el tiempo de cooldown.
 */
export async function verificarYAutoSincronizarTorneo(torneoDoc, equiposLBL = [], updateFirestoreCallback = null) {
    if (!torneoDoc) return { synced: false, data: torneoDoc, reason: 'sin_documento' };

    const estado = (torneoDoc.estado || '').toLowerCase();
    const esActivo = estado === 'en_curso' || estado === 'activo' || estado === 'vivo' || estado === 'underway' || estado === 'group_stages' || estado === 'awaiting_review';
    
    // NUNCA gastar llamadas en torneos finalizados
    if (!esActivo) {
        return { synced: false, data: torneoDoc, reason: 'torneo_finalizado' };
    }

    const slugOId = torneoDoc.challongeId || torneoDoc.datosChallonge?.id || torneoDoc.slug || torneoDoc.id;
    if (!slugOId) {
        return { synced: false, data: torneoDoc, reason: 'sin_id_challonge' };
    }

    const ahora = Date.now();
    const ultimaSync = torneoDoc.ultimaSincronizacionTimestamp || (torneoDoc.actualizadoEn ? new Date(torneoDoc.actualizadoEn).getTime() : 0);
    const cooldownMs = obtenerCooldownRecomendadoMs();

    if (ahora - ultimaSync < cooldownMs) {
        return { 
            synced: false, 
            data: torneoDoc, 
            reason: 'en_cooldown', 
            minutosRestantes: Math.ceil((cooldownMs - (ahora - ultimaSync)) / 60000) 
        };
    }

    try {
        console.log(`[Auto-Sync LBL] Sincronizando en segundo plano torneo activo "${torneoDoc.nombre}"...`);
        const resultado = await procesarTorneoChallonge(slugOId, null, equiposLBL, torneoDoc.division || torneoDoc.tier || 'Tier 1');
        if (resultado) {
            let autoEstado = torneoDoc.estado;
            if (resultado.estado === 'pending') autoEstado = 'proximamente';
            else if (resultado.estado === 'underway' || resultado.estado === 'group_stages_underway') autoEstado = 'vivo';
            else if (resultado.estado === 'complete') autoEstado = 'finalizado';

            const torneoActualizado = {
                ...torneoDoc,
                nombre: resultado.nombre || torneoDoc.nombre,
                estado: autoEstado,
                datosChallonge: resultado,
                partidas: resultado.matches || [],
                matches: resultado.matches || [],
                standings: resultado.standings || [],
                challongeStandings: resultado.challongeStandings || [],
                podio: resultado.podio || torneoDoc.podio,
                ultimaSincronizacionTimestamp: ahora,
                actualizadoEn: new Date().toISOString()
            };

            if (typeof updateFirestoreCallback === 'function') {
                await updateFirestoreCallback(torneoDoc.id, torneoActualizado);
            }

            return { synced: true, data: torneoActualizado, keyUsed: resultado.keyUsed };
        }
    } catch (err) {
        console.warn('[Auto-Sync LBL] Advertencia de sincronización en segundo plano:', err.message);
    }

    return { synced: false, data: torneoDoc, reason: 'error_red' };
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
