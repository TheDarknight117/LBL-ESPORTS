# Informe Técnico: Motor Anti-Smurf y Rastreator Forense (`anti-smurf-core.js`)

**Proyecto:** LBL eSports — Torneo Presencial *Aquí Me Quedo (La Paz) vs SMOK LAN CENTER (Cochabamba)*  
**Módulo Principal:** `public/anti-smurf-core.js`  
**Build actual:** `lbl-v2026.11.26-299`  

---

## 1. Resumen Ejecutivo

El motor Anti-Smurf es un sistema **client-side de auditoría forense y cruce de identidad multi-base** implementado en `public/anti-smurf-core.js`. Su objetivo es automatizar la verificación de elegibilidad (tope estricto **Esmeralda I**), detectar **cuentas alternas / smurfs no declaradas**, identificar **ex-jugadores o titulares de Liga LBL (Tier 1 / Tier 2)**, prevenir **suplantación de identidad** y bloquear **inscripciones duplicadas** dentro del Torneo Presencial (`amq_vs_smok_2026`).

Se conecta con tres puntos del sistema:
1. **`public/torneopresencial.html`:** Valida rango SoloQ, exige formato `#TAG` y región de servidor OP.GG en cuenta main, construye URLs de OP.GG y publica rosters sanitizados.
2. **`public/staff-presencial.html`:** Audita automáticamente cada equipo al cargar, alimenta el **Centro de Alertas**, los badges por jugador, la pestaña **Dictamen** y el **Rastreator Forense Global**.
3. **`public/dashboard.html`:** Muestra el contador en vivo de alertas y enlaza hacia `/staff-presencial`.

---

## 2. Arquitectura y Fuentes de Datos Cruzadas

La función `cargarIndiceHistoricoGlobal()` construye un índice unificado en memoria (con **caché de 5 minutos**, omitible mediante `forceRefresh: true`) cargando en paralelo mediante `Promise.all`:

| Código | Fuente | Origen técnico | Fallback offline / caché |
| :--- | :--- | :--- | :--- |
| `SC1` | Scouting 1 | `/assets/scouting1.json` | Array vacío si falla HTTP |
| `SC2` | Scouting 2 | `/assets/scouting2.json` | Array vacío si falla HTTP |
| `OQ` | Open Qualifier LBL | `/assets/qualifier.json` | Array vacío si falla HTTP |
| `SC3` | Scouting 3 | `SCOUTING3_OFFICIAL_API_URL` (Google Apps Script) | `localStorage`: `lbl_scouting_equipos_cache` y `lbl_scouting3_public_sanitized_v288` |
| `LIGA_T1` / `LIGA_T2` | Liga Oficial LBL (Tier 1 y Tier 2) | Firestore `inscripciones_pendientes` (`roster`, `suplentes`, `jugadores`, `ex_jugadores`) | Query filtrada `estado == 'Aceptado'` o `localStorage` (`lbl_equipos_aceptados_cache`) |
| `BANNED` | Lista Negra LBL | `BANNED_TEAMS` y `BANNED_PLAYERS` en `anti-smurf-core.js` | Embebido en código |
| `TORNEO_LAN` | Inscritos actuales del torneo | Firestore `inscripciones_torneos` | Snapshot en tiempo real en Staff |

---

## 3. Normalización de Identidad e Indexación

Para evitar evasiones por formato distinto (espacios, tildes, prefijos telefónicos o cadenas compuestas de Scouting 3), `registrarEnIndice()` normaliza cada campo antes de insertarlo en **6 mapas de búsqueda rápida (`Map`)**:

* **`porCi` (`extraerCiLimpio`):** Extrae secuencias de **6 a 10 dígitos**, tanto en campos puros como en strings combinados tipo `"Nombre Completo 12345678"` provenientes de Scouting 3.
* **`porCelular` (`normalizarCelular`):** Limpia signos no numéricos y recorta el prefijo de Bolivia (`+591` en números de 11 dígitos o que inicien con `5916` / `5917`) dejando los **8 dígitos locales** para cruce exacto.
* **`porNombreExacto` + comparación por tokens (`normalizarNombrePersona`, `obtenerTokensNombre`, `compararNombresPersona`):**
  * Remueve tildes, bloques numéricos de C.I., abreviaturas departamentales (`lp`, `lpz`, `cbba`, `cba`, `scz`, `sc`, `or`, `pt`, `tj`, `ch`, `bn`, `pd`, `bo`) y stopwords (`de`, `del`, `la`, `las`, `los`, `el`, `san`, `santa`, `y`).
  * Considera coincidencia de persona física si el nombre normalizado es exacto (≥ 5 caracteres), si comparte **≥ 3 tokens significativos** (≥ 3 caracteres cada uno), o si comparte **2 tokens** cuando uno de los registros tiene exactamente 2 palabras.
* **`porRiotFull` (`normalizarRiotId`):** Ignora valores neutros definidos en `IGNORE_RIOT_VALUES` (`n/a`, `na`, `no`, `ninguno`, `misma`, `sin cuenta`, `unranked`, etc.) y compacta `GameName#TAG` en minúsculas sin espacios. Indexa tanto cuenta principal (`riotId`) como secundaria (`riotIdMain`).
* **`porRiotNick` (`extraerNickBaseRiot`):** Indexa el nick base anterior al `#` cuando tiene **≥ 3 caracteres**; en auditoría dispara alerta de similitud cuando tiene **≥ 4 caracteres** y difiere en `#TAG`.
* **`porDiscord` (`normalizarDiscord`):** Minúsculas sin espacios (≥ 3 caracteres).

---

## 4. Soporte Multi-Región OP.GG (Cuenta Torneo y Cuenta Main)

Mientras la cuenta oficial del torneo juega en **LAS** (`REGIONES_OPGG_TORNEO_LAN[0]`), las cuentas main declaradas por los jugadores pueden pertenecer a otros servidores (`LAN`, `BR`, `EUW`, `NA`, etc.).

### Regiones y alias soportados
* **15 servidores oficiales (`REGIONES_OPGG_TORNEO_LAN`):** `las`, `lan`, `br`, `na`, `euw`, `eune`, `kr`, `jp`, `oce`, `tr`, `ru`, `sea`, `tw`, `vn`, `me`.
* **Alias normalizados (`REGION_OPGG_ALIAS`):** `eu` → `euw`; `sg`/`sg2`/`ph`/`ph2`/`th`/`th2` → `sea`; `oc`/`oc1` → `oce`; `la1` → `lan`; `la2` → `las`; `br1` → `br`; `na1` → `na`; `euw1` → `euw`; `eun1` → `eune`; `kr1` → `kr`; `jp1` → `jp`; `tr1` → `tr`; `tw2` → `tw`; `vn2` → `vn`; `me1` → `me`.

### Reglas de resolución (`resolverRegionMainJugador` y `resolverUrlOpggMainJugador`)
1. Si el jugador o el Staff seleccionó explícitamente `regionMain` (`servidorMain`), ese valor prevalece siempre.
2. Si el registro es antiguo (sin `regionMain`) pero `opggMain` apunta a una región distinta de `las`, se conserva esa región.
3. Si `opggMain` apuntaba por defecto a `las` pero el `#TAG` del Riot ID corresponde a un código regional explícito (ej. `#LAN`, `#BR`, `#EUW`), `inferirRegionOpggDeRiotId()` corrige automáticamente la región y reconstruye la URL de OP.GG.
4. En ausencia de coincidencia, usa `'las'` como fallback.
5. `construirUrlOpgg(riotId, region)` limpia espacios alrededor de `#` y codifica `GameName` y `TagLine` por separado con `encodeURIComponent`, evitando errores 404 en OP.GG por espacios previos al `#`.

---

## 5. Flujo de Evaluación de Rango y Detección de Alertas

### 5.1 Evaluación de Tope Esmeralda I (`evaluarRangoSoloQ`)
* **Permitidos (`tierNum` 0 a 7, `excedeEsmeralda1: false`):** `Unranked` (0), `Hierro` (1), `Bronce` (2), `Plata` (3), `Oro` (4), `Platino` (5), `Esmeralda IV–II` (6) y `Esmeralda I` (7).
* **Bloqueados / Críticos (`tierNum` 8 a 11, `excedeEsmeralda1: true`):** `Diamante` / `d1–d4` (8), `Master` / `Maestro` (9), `Grandmaster` / `gm` (10) y `Challenger` / `Retador` (11). Detecta palabras clave incluso en textos compuestos como `"Peak Diamante 3 / Actual Esmeralda 2"`.

### 5.2 Reglas de Auditoría por Equipo y Jugador (`auditarEquipoTorneoLan` y `auditarJugadorTorneoLan`)

Cada jugador (5 titulares + hasta 1 suplente) y el representante/capitán (si no juega en el roster) pasan por las siguientes verificaciones en orden:

```text
Equipo / Jugador
 ├── 1. Lista Negra (BANNED_TEAMS / BANNED_PLAYERS) ────────────────▶ CRITICA
 ├── 2. Rango SoloQ declarado > Esmeralda 1 ────────────────────────▶ CRITICA
 ├── 3. Cruce con las 6 bases históricas (buscarCoincidenciasJugador):
 │    ├── 3a. Participó en Liga LBL Tier 1 ─────────────────────────▶ CRITICA
 │    ├── 3b. Participó en Liga LBL Tier 2 ─────────────────────────▶ OBSERVACION
 │    ├── 3c. Rango histórico en SC1/SC2/SC3/OQ > Esmeralda 1 ──────▶ CRITICA
 │    ├── 3d. Mismo C.I./Whapp/Discord/Nombre con OTRA cuenta Riot ─▶ CRITICA (si >E1 o T1) / OBSERVACION
 │    ├── 3e. Mismo Riot ID registrado antes por OTRA persona/C.I. ─▶ OBSERVACION (posible suplantación)
 │    └── 3f. Coincidencia previa sin infracción ───────────────────▶ HISTORIAL
 └── 4. Duplicidad en el mismo torneo (mismo C.I., Whapp o Riot ID) ▶ CRITICA (MULTIEQUIPO)
```

### 5.3 Catálogo de Códigos y Severidades

| Severidad | Código | Significado operativo |
| :--- | :--- | :--- |
| **Crítica** (`critica`) | `EQUIPO_SANCIONADO` | Nombre o TAG coincide con `BANNED_TEAMS`. |
| **Crítica** (`critica`) | `REPRESENTANTE_SANCIONADO` | Representante coincide con `BANNED_PLAYERS`. |
| **Crítica** (`critica`) | `JUGADOR_SANCIONADO` | Jugador coincide por nombre, Riot ID o Discord con `BANNED_PLAYERS`. |
| **Crítica** (`critica`) | `ELO_DECLARADO_EXCEDIDO` | Rango SoloQ declarado supera Esmeralda I. |
| **Crítica** (`critica`) | `HISTORIAL_LIGA_TIER1` | Jugador detectado en Liga LBL Tier 1. |
| **Crítica** (`critica`) | `ELO_HISTORICO_EXCEDIDO` | Rango histórico en SC1/SC2/SC3/OQ supera Esmeralda I. |
| **Crítica** (`critica`) | `CUENTA_ALTERNA_DETECTADA` | Misma persona jugó antes con otra cuenta cuyo Elo excedía Esmeralda I o era Tier 1. |
| **Crítica** (`critica`) | `MULTIEQUIPO_TORNEO_LAN` | Jugador inscrito simultáneamente en otro equipo no rechazado del mismo torneo. |
| **Observación** (`observacion`) | `HISTORIAL_LIGA_TIER2` | Jugador con historial en Liga LBL Tier 2 (requiere revisión manual de Elo). |
| **Observación** (`observacion`) | `CUENTA_ALTERNA_DETECTADA` | Misma persona jugó antes con otra cuenta de Riot no declarada (Elo histórico ≤ E1). |
| **Observación** (`observacion`) | `POSIBLE_SUPLANTACION_CUENTA` | Mismo Riot ID usado previamente por otro C.I. o nombre distinto. |
| **Historial** (`historial`) | `HISTORIAL_PREVIO_DETECTADO` | Antecedente legítimo en bases LBL para trazabilidad del Staff. |

---

## 6. Rastreator Forense Global y Privacidad en Vitrina Pública

* **Rastreator Forense (`buscarEnPadronForenseGlobal`):** Permite búsquedas instantáneas del Staff por C.I., celular (≥ 5 dígitos) o texto libre (`_searchBlob`) sobre las 6 bases históricas más los inscritos del torneo actual (hasta 120 resultados).
* **Sanitizador Público (`sanitizarEquipoTorneoLanPublico`):** Filtra exclusivamente equipos con `estado == 'Aceptado'` y expone únicamente información pública del equipo y roster (`riotIdTorneo`, `opggTorneo`, `riotIdMain`, `regionMain`, `opggMain`, roles, `rangoMax`, `esCapitan`), omitiendo por completo C.I., nombres reales, teléfonos y Discord.

---

## 7. Alcance y Límites Operativos

* El motor realiza los cruces **100% sobre datos internos y declarados** (Scouting 1–3, Open Qualifier, Liga Tier 1–2, Sancionados e inscritos del torneo actual), sin consultar en vivo la API privada de Riot Games desde el cliente público.
* La verificación de **winrate, MMR oculto y Elo real en vivo en SoloQ/Flex** dentro de servidores externos se apoya en los botones directos **OP.GG LAS** y **OP.GG [REGIÓN]** generados con la región correcta seleccionada en inscripción o editada por el Staff.
