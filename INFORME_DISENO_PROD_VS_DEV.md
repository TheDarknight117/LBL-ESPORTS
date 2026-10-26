# Informe de Implementaciones y Mejoras de Diseño: Producción vs. Desarrollo
**Liga Boliviana de League of Legends (LBL eSports)**  
**Rama Base (Producción):** `origin/main`  
**Rama de Trabajo (Desarrollo):** `desarrollo-rediseno-afiche`  
**Fecha de Emisión:** 13 de Octubre de 2026  

---

## 1. Resumen Ejecutivo

El presente informe detalla la reestructuración visual, arquitectónica y de experiencia de usuario (UX/UI) implementada en el proyecto **LBL eSports**. El objetivo principal fue transformar el sitio web desde una maquetación web tradicional de flujo continuo hacia un **sistema de afiches cinematográficos de pantalla completa (`.section-afiche`)**, garantizando una experiencia *mobile first* estricta, rendimiento fluido y eliminación de anomalías visuales previas.

---

## 2. Matriz Comparativa por Sección del Homepage

| Sección | Estado en Producción (`main`) | Estado en Desarrollo (`desarrollo-rediseno-afiche`) | Tipo de Mejora | Impacto Técnico y Visual |
| :--- | :--- | :--- | :--- | :--- |
| **Arquitectura Global** | Scroll continuo tradicional con secciones de altura variable. En móviles se asomaban fragmentos de la siguiente sección en el fondo. | Sistema de **Afiches Seccionales (`.section-afiche`)** con altura estricta `min-height: calc(100svh - 60px); calc(100dvh - 60px)` y centrado vertical automático. | Arquitectura & Layout | Presentación limpia "pantalla por pantalla" adaptativa para cualquier resolución móvil (iPhone SE, iPhone Pro, Pixel, Galaxy). |
| **Hero (`#hero`)** | Video con filtros pesados de desenfoque (`blur`) que generaban ruido y grano; botón intrusivo de instalación PWA junto a los CTAs; título con cortes en glifos itálicos. | Video de fondo nativo en alta definición (`v4Hero.mp4`); triada limpia de botones de acción con efecto *shimmer*; título forzado a 2 líneas exactas con compensación de padding itálico; botón de navegación `Explora la Liga`. | Visual & UX | Impacto visual cinematográfico sin grano. En móvil: botón principal full width + grid ergonómico de 2 columnas para Rosters y Torneos. |
| **Clasificaciones (`#clasificaciones`)** | Fondo negro genérico plano; carrusel con micro-saltos por subpíxeles; tarjetas comprimidas (87px de alto) que dejaban 60% de la pantalla en vacío negro en teléfonos. | **Brackets Vectoriales de Playoffs** con conectores punteados animados (`bracket-flow-dash`), radar de telemetría HUD con haz rotativo (`radar-sweep-anim`), mural tipográfico *typewriter* letra por letra. Carrusel táctil fluido con tarjetas sólidas (`w-[76vw] max-w-[280px]`, logos `h-12 xs:h-14`). | Visual, Animación & Mobile | Identidad temática de torneos oficiales de eSports; elimina el vacío visual en móviles y ofrece navegación táctil fluida. |
| **Circuito Competitivo (`#circuito`)** | Bloques oscuros estáticos con degradados estándar. | Video temático en bucle (`overlaylol.mp4`) controlado mediante `IntersectionObserver` (reproducción bajo demanda); iluminación focal dual oro/azul; tarjetas de Primera División (Tier 1) y Ascenso Oficial (Tier 2) con transparencia cinematográfica reactiva en hover. | Rendimiento & UI | Jerarquía evidente entre categorías competitivas sin consumo innecesario de batería o datos. |
| **Sponsors Oficiales (`#sponsors`)** | Parpadeo recurrente (*flicker*) al cambiar de slide en Barón Nashor; textos de patrocinador cortados con saltos de línea forzados; banner pequeño. | **Eliminación total de parpadeo** mediante pre-renderizado en DOM; escala aumentada un +30%; fondo con patrón geométrico de panal (*honeycomb*) y reflejos metálicos; descripciones unificadas a **1 sola línea continua**; barra de progreso minimalista de 2px. | Comercial & Branding | Mayor estatus para patrocinadores (VOLT, Legion Store, Iconic, Aquí Me Quedo). Legibilidad uniforme en pantallas móviles y desktop. |
| **Staff & Directiva (`#staff`)** | Tarjetas trapezoidales con problemas de interacción táctil; fondo plano. | **HUD Táctico estilo Champions / Valorant:** Matriz de puntos (*dot grid*), cruces de calibración, micro-marcas y radar de 24Hz. Acordeón elástico calibrado a `clamp(200px, 30vh, 230px)` con aceleración GPU (`translateZ(0)`) y desactivación de clip-path en móviles. | Interactividad & Mobile | Interacción táctil suave y ágil en smartphones, conservando estética futurista en monitores grandes. |
| **Footer Institucional** | Pie de página básico con enlaces simples. | **Footer Tier 1 eSports:** Estructura modular de 3 niveles con misión oficial, navegación estructurada (Competición, Ecosistema, Transmisión), redes oficiales con brillo temático interactivo (Twitch, Kick, Discord, etc.) y badges institucionales. | Identidad de Marca | Acabado formal de estándar internacional para la liga. |

---

## 3. Correcciones de Usabilidad en Módulos Internos

### Módulo de Scouting (`public/scouting.html`)

| Componente | Problema en Producción | Solución Aplicada en Desarrollo |
| :--- | :--- | :--- |
| **Barra de Búsqueda** | El icono de la lupa se solapaba sobre el texto del *placeholder* y las búsquedas escritas. | Ajuste del padding interno izquierdo (`pl-10`), garantizando separación visual limpia entre icono y texto. |
| **Jerarquía de Controles** | El identificador de "Base de Datos Oficial" estaba desalineado y rompía el ritmo visual superior. | Reorganización en dos niveles claros: indicador oficial centrado y destacado en cabecera; debajo, la barra de búsqueda y filtros. |
| **Ubicación de Filtros** | Se habían desplazado a posiciones elevadas poco intuitivas para el usuario. | Reubicación bajo los banners de torneo, respetando el flujo de navegación natural. |

---

## 4. Mejoras Técnicas, Rendimiento y Caché

| Mecanismo | Implementación | Propósito / Beneficio |
| :--- | :--- | :--- |
| **Navegación entre Afiches** | Botones indicadores `.afiche-scroll-wrap` vinculados a la API nativa `scrollIntoView({ behavior: 'smooth', block: 'start' })`. | Transición suave entre afiches sin ensuciar la barra de direcciones con *hashes* (`#clasificaciones`, `#circuito`). |
| **Control de Caché en Producción** | Sincronización entre `public/app-version.js` (`lbl-v2026.10.03-196`) y parámetros `?v=192` en `public/index.html`. | Purga automática de cachés antiguas en clientes móviles y navegadores sin requerir borrado manual de datos por el usuario. |
| **Prevención de Saltos de Recarga** | Configuración de `history.scrollRestoration = 'manual'` y forzado de `window.scrollTo(0, 0)`. | Garantiza que cualquier usuario que recargue o ingrese al sitio inicie siempre desde el Hero. |
| **Compilación CSS** | Pipeline de Tailwind CSS procesado hacia `public/dist/output.css` con compresión minificada. | Eliminación de CSS superfluo, menor peso de transferencia y máxima velocidad de renderizado. |

---

## 5. Estado de Despliegue

```
[origin/main] ──────► Producción Estable (Sin modificaciones)
                          │
                          ▼
[desarrollo-rediseno-afiche] ──► Rama Remota Actualizada en GitHub
                                  - 100% de cambios commiteados y pusheados.
                                  - Servidor local verificado en http://localhost:8000/
```
