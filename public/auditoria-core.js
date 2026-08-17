/**
 * Módulo Core de Auditoría y Detección de Cambios de Roster / Identidad (LBL Esports)
 * 100% Retrocompatible: Diseñado para operar con documentos que tengan o no campos de historial previos.
 */

// Normalizar strings para comparaciones fiables
const norm = (str) => (str ? str.toString().trim().toLowerCase() : '');

/**
 * Extrae todos los jugadores activos de un equipo (Titulares + Suplentes) en una lista plana
 */
export function extraerJugadoresPlanos(equipo) {
    const lista = [];
    if (!equipo) return lista;

    // Titulares
    if (equipo.roster) {
        const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUPP'];
        roles.forEach(rol => {
            const p = equipo.roster[rol];
            if (p && (p.riotId || p.nombre)) {
                lista.push({
                    ...p,
                    rolClave: rol,
                    rolNombre: rol,
                    tipo: 'Titular'
                });
            }
        });
    }

    // Suplentes
    if (Array.isArray(equipo.suplentes)) {
        equipo.suplentes.forEach((p, idx) => {
            if (p && (p.riotId || p.nombre)) {
                lista.push({
                    ...p,
                    rolClave: `SUP_${idx}`,
                    rolNombre: p.rol_seleccionado || `Suplente #${idx + 1}`,
                    tipo: 'Suplente'
                });
            }
        });
    }

    return lista;
}

/**
 * Analiza las diferencias entre el estado previo de un equipo y el nuevo estado a guardar.
 * Detecta: Renombres (mismo CI/Nombre, distinto RiotID), Nuevos Fichajes, Bajas y Transferencias.
 */
export function procesarAuditoriaEquipo(equipoOriginal, datosNuevos, autor, todosLosEquipos = [], autorTipo = null) {
    const fechaISO = new Date().toISOString();
    const cambios = [];
    const exJugadoresActualizados = Array.isArray(equipoOriginal.ex_jugadores) ? [...equipoOriginal.ex_jugadores] : [];

    const jugadoresViejos = extraerJugadoresPlanos(equipoOriginal);
    const jugadoresNuevos = extraerJugadoresPlanos(datosNuevos);

    // 1. COMPARAR IDENTIDAD DEL EQUIPO
    const eqViejo = equipoOriginal.equipo || {};
    const eqNuevo = datosNuevos.equipo || {};

    if (norm(eqViejo.nombre) !== norm(eqNuevo.nombre)) {
        cambios.push({
            campo: 'Nombre del Equipo',
            anterior: eqViejo.nombre || 'Sin nombre',
            nuevo: eqNuevo.nombre || 'Sin nombre',
            tipoCambio: 'identidad'
        });
    }

    if (norm(eqViejo.tag) !== norm(eqNuevo.tag)) {
        cambios.push({
            campo: 'TAG del Equipo',
            anterior: eqViejo.tag || 'Sin TAG',
            nuevo: eqNuevo.tag || 'Sin TAG',
            tipoCambio: 'identidad'
        });
    }

    if (norm(eqViejo.logo) !== norm(eqNuevo.logo)) {
        cambios.push({
            campo: 'Logo del Equipo',
            anterior: eqViejo.logo ? 'Logo Anterior' : 'Sin logo',
            nuevo: eqNuevo.logo ? 'Nuevo Logo' : 'Sin logo',
            tipoCambio: 'identidad'
        });
    }

    if (eqNuevo.tier && norm(eqViejo.tier) !== norm(eqNuevo.tier)) {
        cambios.push({
            campo: 'Tier Oficial',
            anterior: eqViejo.tier || 'Sin Tier',
            nuevo: eqNuevo.tier || 'Sin Tier',
            tipoCambio: 'institucional'
        });
    }

    // 2. COMPARAR REDES SOCIALES / MEDIA
    const medViejo = equipoOriginal.media || {};
    const medNuevo = datosNuevos.media || {};
    if (datosNuevos.media) {
        ['instagram', 'tiktok', 'facebook', 'twitter', 'discord'].forEach(red => {
            if (norm(medViejo[red]) !== norm(medNuevo[red])) {
                cambios.push({
                    campo: `Red Social (${red.toUpperCase()})`,
                    anterior: medViejo[red] || 'No registrada',
                    nuevo: medNuevo[red] || 'Eliminada',
                    tipoCambio: 'contacto'
                });
            }
        });
    }

    // 3. COMPARAR REPRESENTANTES / CONTACTOS
    const repsViejos = equipoOriginal.representantes || [];
    const repsNuevos = datosNuevos.representantes || [];
    if (datosNuevos.representantes) {
        const maxReps = Math.max(repsViejos.length, repsNuevos.length, 2);
        for (let i = 0; i < maxReps; i++) {
            const rV = repsViejos[i] || {};
            const rN = repsNuevos[i] || {};
            if (norm(rV.nombre) !== norm(rN.nombre) || norm(rV.telefono) !== norm(rN.telefono) || norm(rV.ci) !== norm(rN.ci)) {
                if (rV.nombre || rN.nombre) {
                    cambios.push({
                        campo: `Representante #${i + 1} (${rN.rol || rV.rol || 'Contacto'})`,
                        anterior: rV.nombre ? `${rV.nombre} (${rV.telefono || 'Sin tel'})` : 'No asignado',
                        nuevo: rN.nombre ? `${rN.nombre} (${rN.telefono || 'Sin tel'})` : 'Removido',
                        tipoCambio: 'contacto'
                    });
                }
            }
        }
    }

    // 4. COMPARAR COACHES / STAFF TÉCNICO
    const coachesViejos = equipoOriginal.coaches || [];
    const coachesNuevos = datosNuevos.coaches || [];
    if (datosNuevos.coaches) {
        const maxCoaches = Math.max(coachesViejos.length, coachesNuevos.length, 2);
        for (let i = 0; i < maxCoaches; i++) {
            const cV = coachesViejos[i] || {};
            const cN = coachesNuevos[i] || {};
            if (norm(cV.nombre) !== norm(cN.nombre) || norm(cV.riotId) !== norm(cN.riotId) || norm(cV.ci) !== norm(cN.ci)) {
                if (cV.nombre || cN.nombre) {
                    cambios.push({
                        campo: `Coach #${i + 1} (${cN.rol || cV.rol || 'Staff Técnico'})`,
                        anterior: cV.nombre ? `${cV.nombre} [${cV.riotId || 'Sin ID'}]` : 'Sin coach',
                        nuevo: cN.nombre ? `${cN.nombre} [${cN.riotId || 'Sin ID'}]` : 'Removido',
                        tipoCambio: 'staff_tecnico'
                    });
                }
            }
        }
    }

    // 5. COMPARAR JUGADORES (TITULARES Y SUPLENTES)
    
    // Mapear jugadores antiguos por CI (o Nombre si no hay CI)
    const viejosPorIdentidad = new Map();
    jugadoresViejos.forEach(p => {
        const idKey = norm(p.ci) || norm(p.nombre);
        if (idKey) viejosPorIdentidad.set(idKey, p);
    });

    const nuevosPorIdentidad = new Map();
    jugadoresNuevos.forEach(p => {
        const idKey = norm(p.ci) || norm(p.nombre);
        if (idKey) nuevosPorIdentidad.set(idKey, p);
    });

    // Detectar Cambios por Posición (TOP, JG, MID, ADC, SUPP)
    const rolesTitulares = ['TOP', 'JG', 'MID', 'ADC', 'SUPP'];
    rolesTitulares.forEach(rol => {
        const pViejo = equipoOriginal.roster ? equipoOriginal.roster[rol] : null;
        const pNuevo = datosNuevos.roster ? datosNuevos.roster[rol] : null;

        const riotViejo = pViejo?.riotId?.trim() || '';
        const riotNuevo = pNuevo?.riotId?.trim() || '';
        const ciViejo = pViejo?.ci?.trim() || '';
        const ciNuevo = pNuevo?.ci?.trim() || '';
        const nomViejo = pViejo?.nombre?.trim() || '';
        const nomNuevo = pNuevo?.nombre?.trim() || '';

        if (riotViejo !== riotNuevo || nomViejo !== nomNuevo || ciViejo !== ciNuevo) {
            // Caso A: Es la misma persona física (mismo CI o Nombre) pero cambió su Riot ID
            if ((ciViejo && ciViejo === ciNuevo) || (nomViejo && norm(nomViejo) === norm(nomNuevo))) {
                if (riotViejo !== riotNuevo) {
                    cambios.push({
                        campo: `Roster ${rol}`,
                        anterior: riotViejo || 'Sin Riot ID',
                        nuevo: riotNuevo || 'Sin Riot ID',
                        jugadorNombre: nomNuevo || nomViejo,
                        tipoCambio: 'cambio_nombre',
                        detalle: `${nomNuevo} cambió su Riot ID de "${riotViejo}" a "${riotNuevo}"`
                    });
                }
            } else {
                // Caso B: Es un jugador diferente en esta posición
                if (riotViejo && !riotNuevo) {
                    cambios.push({
                        campo: `Roster ${rol}`,
                        anterior: `${riotViejo} (${nomViejo})`,
                        nuevo: 'Vacío (Baja)',
                        tipoCambio: 'baja',
                        detalle: `${riotViejo} dejó la posición ${rol}`
                    });
                } else if (!riotViejo && riotNuevo) {
                    cambios.push({
                        campo: `Roster ${rol}`,
                        anterior: 'Vacío',
                        nuevo: `${riotNuevo} (${nomNuevo})`,
                        tipoCambio: 'fichaje',
                        detalle: `${riotNuevo} ingresó como titular en ${rol}`
                    });
                } else if (riotViejo && riotNuevo) {
                    cambios.push({
                        campo: `Roster ${rol}`,
                        anterior: `${riotViejo} (${nomViejo})`,
                        nuevo: `${riotNuevo} (${nomNuevo})`,
                        tipoCambio: 'reemplazo',
                        detalle: `${riotNuevo} reemplaza a ${riotViejo} en ${rol}`
                    });
                }
            }
        }
    });

    // Detectar Bajas Generales (Jugadores viejos que ya no están en ninguna parte del equipo nuevo)
    jugadoresViejos.forEach(pViejo => {
        const idKey = norm(pViejo.ci) || norm(pViejo.nombre);
        if (idKey && !nuevosPorIdentidad.has(idKey)) {
            // Se fue del equipo -> Registrar en ex_jugadores si no estaba ya
            const yaRegistrado = exJugadoresActualizados.some(ex => (norm(ex.ci) && norm(ex.ci) === norm(pViejo.ci)) || (norm(ex.nombre) === norm(pViejo.nombre) && norm(ex.riotId) === norm(pViejo.riotId)));
            
            if (!yaRegistrado) {
                // Verificar si se fue a otro equipo
                let destinoNombre = null;
                if (todosLosEquipos && todosLosEquipos.length > 0) {
                    for (const otroEq of todosLosEquipos) {
                        if (otroEq.id !== equipoOriginal.id) {
                            const jugadoresOtro = extraerJugadoresPlanos(otroEq);
                            const encontrado = jugadoresOtro.find(j => (norm(j.ci) && norm(j.ci) === norm(pViejo.ci)) || (norm(j.nombre) === norm(pViejo.nombre)));
                            if (encontrado) {
                                destinoNombre = otroEq.equipo?.nombre || 'Otro Equipo';
                                break;
                            }
                        }
                    }
                }

                exJugadoresActualizados.unshift({
                    ci: pViejo.ci || '',
                    nombre: pViejo.nombre || '',
                    riotId: pViejo.riotId || '',
                    rol: pViejo.rolNombre || pViejo.rolClave || 'Jugador',
                    tipo: pViejo.tipo || 'Titular',
                    fechaSalida: fechaISO,
                    motivo: destinoNombre ? `Transferencia a ${destinoNombre}` : 'Baja de Roster',
                    destinoEquipoNombre: destinoNombre
                });
            }
        }
    });

    // Detectar Fichajes / Transferencias de Nuevos Jugadores
    jugadoresNuevos.forEach(pNuevo => {
        const idKey = norm(pNuevo.ci) || norm(pNuevo.nombre);
        if (idKey && !viejosPorIdentidad.has(idKey)) {
            // Verificar si este jugador venía de otro equipo
            let origenNombre = null;
            if (todosLosEquipos && todosLosEquipos.length > 0) {
                for (const otroEq of todosLosEquipos) {
                    if (otroEq.id !== equipoOriginal.id) {
                        const jugadoresOtro = extraerJugadoresPlanos(otroEq);
                        const encontrado = jugadoresOtro.find(j => (norm(j.ci) && norm(j.ci) === norm(pNuevo.ci)) || (norm(j.nombre) === norm(pNuevo.nombre)));
                        if (encontrado) {
                            origenNombre = otroEq.equipo?.nombre || 'Otro Equipo';
                            break;
                        }
                    }
                }
            }

            if (origenNombre) {
                cambios.push({
                    campo: `${pNuevo.tipo} (${pNuevo.rolNombre})`,
                    anterior: `Procedente de ${origenNombre}`,
                    nuevo: `${pNuevo.riotId} (${pNuevo.nombre})`,
                    tipoCambio: 'transferencia',
                    detalle: `Traspaso: ${pNuevo.riotId} llega desde ${origenNombre} a ${eqNuevo.nombre || 'el equipo'}`
                });
            } else {
                cambios.push({
                    campo: `${pNuevo.tipo} (${pNuevo.rolNombre})`,
                    anterior: 'Sin registro previo',
                    nuevo: `${pNuevo.riotId} (${pNuevo.nombre})`,
                    tipoCambio: 'fichaje',
                    detalle: `Nuevo fichaje: ${pNuevo.riotId} (${pNuevo.nombre}) se incorpora al equipo`
                });
            }
        }
    });

    // 6. CAPITÁN
    if (datosNuevos.capitan && norm(equipoOriginal.capitan) !== norm(datosNuevos.capitan)) {
        cambios.push({
            campo: 'Capitán Asignado',
            anterior: equipoOriginal.capitan || 'TOP',
            nuevo: datosNuevos.capitan,
            tipoCambio: 'capitania'
        });
    }

    // 4. GENERAR LOG DE AUDITORÍA
    const historialActualizado = Array.isArray(equipoOriginal.historial_ediciones) ? [...equipoOriginal.historial_ediciones] : [];

    if (cambios.length > 0) {
        const tipoFinal = autorTipo || (autor && autor.toLowerCase().includes('staff') ? 'STAFF' : 'TEAM');
        const eventoAuditoria = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            fecha: fechaISO,
            autorTipo: tipoFinal, // 'STAFF' o 'TEAM'
            autor: autor || (tipoFinal === 'STAFF' ? 'Staff LBL' : 'Capitán / Team'),
            resumen: `${cambios.length} cambio(s) aplicado(s)`,
            cambios: cambios
        };
        historialActualizado.unshift(eventoAuditoria);
    }

    return {
        cambios,
        historial_ediciones: historialActualizado,
        ex_jugadores: exJugadoresActualizados,
        updatedAt: fechaISO
    };
}
