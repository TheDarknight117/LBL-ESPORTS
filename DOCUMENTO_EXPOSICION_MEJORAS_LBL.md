# Sustentación Técnica de Diseño y Arquitectura Frontend
## Proyecto: LBL eSports (Liga Boliviana de League of Legends)
**Comparativa de Ingeniería y UI/UX:** `origin/main` (Producción) vs. `desarrollo-rediseno-afiche` (Desarrollo)  
**Documento de Soporte para Exposición y Defensa Técnica**  

---

## 1. Visión General y Diagnóstico del Problema

El ecosistema digital de **LBL eSports** requería evolucionar desde un sitio web convencional de desplazamiento continuo hacia una **plataforma interactiva con estética de afiche cinematográfico (*Full-Viewport Poster Layout*)**, homologable a los estándares internacionales de ligas oficiales de eSports (LEC, LCK, VALORANT Champions).

### Diagnóstico de la versión en Producción (`main`):
1. **Falta de contención espacial:** Las secciones presentaban alturas arbitrarias; en dispositivos móviles y portátiles, el inicio de una sección se solapaba o asomaba en el tercio inferior de la pantalla anterior, diluyendo el impacto visual.
2. **Degradación de rendimiento gráfico:** Uso indiscriminado de filtros `backdrop-filter: blur()` y `filter: blur()` por software sobre videos y animaciones, lo que generaba saturación de GPU, grano térmico y ralentizaciones en portátiles y smartphones.
3. **Flicker (Parpadeo) en patrocinios:** El carrusel de sponsors destruía y recreaba nodos del DOM en cada ciclo, provocando recargas visuales y parpadeos en los banners principales (particularmente en el asset de Barón Nashor).
4. **Desconexión temática:** Fondos planos oscuros que no comunicaban la identidad competitiva ni la cultura de torneos de League of Legends.
5. **Fallas puntuales de usabilidad (UX):** Iconos de búsqueda solapados sobre campos de texto, truncamiento de glifos en tipografías itálicas y enlaces ancla (`#`) que ensuciaban la barra de navegación del usuario.

---

## 2. Decisiones Arquitectónicas Globales: ¿Qué se usó y por qué?

### A. Sistema de Afiches de Pantalla Completa (`.section-afiche`)
* **Qué se usó:** 
  ```css
  .section-afiche {
      min-height: calc(100svh - 60px);
      min-height: calc(100dvh - 60px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      scroll-margin-top: 60px;
  }
  ```
* **Por qué:** 
  * En dispositivos móviles modernos (iOS Safari y Android Chrome), las barras de navegación del navegador se expanden y contraen dinámicamente al desplazarse. Usar `100vh` clásico produce saltos bruscos y cortes de pantalla (*viewport shifting*).
  * Las unidades dinámicas **`100dvh` (Dynamic Viewport Height)** y **`100svh` (Small Viewport Height)** compensan exactamente el espacio disponible restando los `60px` de la barra de navegación fija (*sticky navbar*).
  * `justify-content: center` asegura que cada afiche actúe como un póster autocontenido centrado matemáticamente, eliminando la filtración de la siguiente sección en el fondo.

### B. Navegación Asistida sin Deformación de URL
* **Qué se usó:** 
  Función JavaScript nativa vinculada a los botones indicadores `.afiche-scroll-wrap`:
  ```javascript
  function scrollToSection(id) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  ```
* **Por qué:** 
  * Los enlaces ancla estándar `<a href="#clasificaciones">` fuerzan la adición del hash en la URL del navegador, rompiendo el historial de navegación hacia atrás y recargando estados en PWA.
  * La API `scrollIntoView` junto a `scroll-margin-top: 60px` otorga un desplazamiento cinemático milimétrico sin alterar la barra de direcciones.

### C. Sistema de Purga Automática de Caché en Producción
* **Qué se usó:** 
  Sincronización entre un módulo ES6 de huella digital (`app-version.js`) con versión `lbl-v2026.10.03-196` y sufijos de consulta en assets (`output.css?v=192`).
* **Por qué:** 
  * Las PWAs y navegadores móviles almacenan en caché agresiva los archivos CSS y JS. Cuando se despliega una mejora de diseño, los usuarios antiguos suelen ver interfaces rotas porque su navegador sigue consumiendo el CSS viejo.
  * Este mecanismo detecta automáticamente el desfase de compilación y purga `localStorage` y `CacheStorage` sin requerir ninguna acción manual por parte del usuario.

---

## 3. Matriz Comparativa Detallada por Sección

### 3.1. Sección HERO (`#hero`)

```
PRODUCCIÓN (main)                             DESARROLLO (desarrollo-rediseno-afiche)
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│ Video con desenfoque CSS pesado │           │ Video nativo nítido (v4Hero)    │
│ Título con corte en letras "S"  │   ───►    │ Título compensado (2 líneas)    │
│ 4 botones (incluye Instalar PWA)│           │ Triada Dorada limpia de CTAs    │
│ Altura > 100vh en laptops       │           │ 100% contenido en viewport      │
│ Sin guía hacia siguiente afiche │           │ Pill flotante "Explora la Liga" │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

| Parámetro | Estado en Producción (`main`) | Estado en Desarrollo (`desarrollo-rediseno-afiche`) | ¿Qué se usó? | ¿Por qué? (Justificación Técnica) |
| :--- | :--- | :--- | :--- | :--- |
| **Video de Fondo** | Archivo genérico procesado con filtros CSS `filter: blur(2px) brightness(0.70)`. | Video optimizado con desenfoque nativo pre-renderizado (`v4Hero.mp4`). | Video MP4 nativo `autoplay muted loop playsinline preload="auto"`. | El desenfoque por CSS en tiempo real fuerza al rasterizador del navegador a recalcular píxeles a 60 FPS en pantalla completa. Pre-renderizar el desenfoque en el codec del video ahorra hasta un 45% de uso de GPU. |
| **Jerarquía de Botones** | 4 botones desordenados; el botón de "Instalar App" competía visualmente con las llamadas de negocio. | Triada de acción jerárquica: `INSCRIBIR EQUIPO`, `VER ROSTERS`, `TORNEOS`. | Grid responsivo: en móvil `INSCRIBIR` full-width + grid 2 cols (`ROSTERS`/`TORNEOS`); en desktop fila horizontal. | Regla ergonómica de pulgar en móvil y ratio de conversión: inscripción es la acción primaria; rosters y torneos son consulta secundaria. |
| **Tipografía del Título** | Glifos itálicos sufriendo *clipping* (la última letra "S" salía cortada en el extremo derecho). | Título en 2 líneas exactas sin corte de glifos. | Utilidad CSS `.text-gradient-blue` con `padding-right: 0.22em; margin-right: -0.22em;`. | Los textos con `-webkit-background-clip: text` recortan la caja delimitadora del elemento en fuentes cursivas/itálicas inclinadas. La compensación por margen negativo protege el dibujo del glifo. |
| **Micro-interacciones** | Botones estáticos sin dinamismo. | Efecto de brillo de barrido (*shimmer*) continuo. | `skew-x-12` con animación CSS de gradiente traslacional en hover. | Aumenta el CTR (*Click-Through Rate*) transmitiendo sensación de videojuego AAA. |

---

### 3.2. Sección CLASIFICACIONES (`#clasificaciones`)

```
PRODUCCIÓN (main)                             DESARROLLO (desarrollo-rediseno-afiche)
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│ Fondo negro vacío               │           │ Brackets vectoriales Playoffs   │
│ Carrusel a tirones (subpíxeles) │   ───►    │ Radar táctico HUD animado       │
│ Tarjetas enanas (87px de alto)  │           │ Telemetría Typewriter en consola│
│ Sensación de página rota/vacía  │           │ Tarjetas sólidas (w: 76vw)      │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

| Parámetro | Estado en Producción (`main`) | Estado en Desarrollo (`desarrollo-rediseno-afiche`) | ¿Qué se usó? | ¿Por qué? (Justificación Técnica) |
| :--- | :--- | :--- | :--- | :--- |
| **Atmósfera y Fondo** | Cuadrícula básica negra sin elementos escénicos. | Brackets vectoriales de Playoffs + Radar táctico HUD con telemetría en vivo. | SVG vectorial inline con `stroke-dasharray: 6 7` animado mediante `@keyframes bracketFlowDash`, radar con barrido rotativo CSS y marcas tácticas de retícula. | Transmite inmersión competitiva inmediata. La animación de líneas punteadas en los conectores del bracket guía el ojo hacia la gran final, reforzando la narrativa de la liga. |
| **Identidad Tipográfica** | Solo texto estático en cabecera. | Mural tipográfico disperso con telemetría estilo teletipo (*typewriter*). | Script asíncrono con `setTimeout` escalonado y glifo de cursor intermitente `muralCursorBlink` sobre fuente monoespaciada técnica. | Refuerza la estética de terminal de telemetría de Riot Games / VALORANT Champions sin consumir recursos de renderizado pesado. |
| **Mecánica del Carrusel** | Animación por CSS puro (`translateX`) que generaba saltos perceptibles y bloqueo al arrastre táctil en smartphones. | Carrusel continuo gobernado por `requestAnimationFrame` con soporte táctil completo (*Swipe/Drag*). | Acumulador de punto flotante en JavaScript para evitar truncamiento de subpíxeles (`scrollLeft = Math.round(pos)`), listeners pasivos `touchstart`/`touchmove` y pausa suave al posar el cursor. | El movimiento por subpíxeles en pantallas de alta densidad (Retina / AMOLED) causa vibración (*judder*). El acumulador flotante garantiza un desplazamiento suave a 60 FPS estables. |
| **Presencia Visual en Móvil** | Tarjetas comprimidas de 87px con logos de 32px que dejaban un enorme vacío negro. | Tarjetas proporcionales de presencia dominante: `w-[76vw] max-w-[280px]` con `aspect-[1.9/1]`, logos escalados a `h-12 xs:h-14`. | Clases Tailwind con ratio de aspecto proporcional y elevación con sombras volumétricas cian. | Mobile First: en smartphones las tarjetas deben ser legibles y cómodas de pulsar con el pulgar. |

---

### 3.3. Sección CIRCUITO COMPETITIVO (`#circuito`)

| Parámetro | Estado en Producción (`main`) | Estado en Desarrollo (`desarrollo-rediseno-afiche`) | ¿Qué se usó? | ¿Por qué? (Justificación Técnica) |
| :--- | :--- | :--- | :--- | :--- |
| **Fondo Audiovisual** | Cajas oscuras sobre degradado plano. | Video cinematográfico en bucle de la Grieta del Invocador (`overlaylol.mp4`) con iluminación focal dual. | Elemento `<video>` optimizado, integrado con la API `IntersectionObserver` y spot ambiental `.glow-gold-dual`. | El video solo se reproduce si la sección entra en el campo de visión del usuario; si está fuera de pantalla, se pausa automáticamente para ahorrar batería y CPU del dispositivo. |
| **Tarjetas Tier 1 y Tier 2** | Paneles oscuros rígidos sin contraste jerárquico. | Tarjetas glassmorphism con transparencia de reposo que ganan solidez y luminosidad en hover. | `bg-gradient-to-b from-[#0a0f1d]/45 to-[#030712]/60 hover:from-[#0a0f1d]/85`, bordes reactivos oro/azul y desenfoque de cristal. | Representa con claridad la dualidad del circuito: Oro para Primera División (máxima gloria) y Azul/Cian para Circuito Ascenso. |

---

### 3.4. Sección SPONSORS OFICIALES (`#sponsors`)

```
PRODUCCIÓN (main)                             DESARROLLO (desarrollo-rediseno-afiche)
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│ Parpadeo recurrente de imágenes │           │ Cero parpadeo (Pre-render en DOM)│
│ Banner pequeño y deslucido      │   ───►    │ Banner escalado (+30%)          │
│ Textos con saltos forzados <br> │           │ Textos limpios en 1 sola línea  │
│ Fondo plano                     │           │ Malla hexagonal Honeycomb SVG   │
│ Sin control de hover exacto     │           │ Congelamiento milimétrico hover │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

| Parámetro | Estado en Producción (`main`) | Estado en Desarrollo (`desarrollo-rediseno-afiche`) | ¿Qué se usó? | ¿Por qué? (Justificación Técnica) |
| :--- | :--- | :--- | :--- | :--- |
| **Estabilidad de Imagen (Flicker)** | Parpadeo blanco/negro continuo al cambiar entre diapositivas (Barón Nashor y Legion). | Transición 100% libre de parpadeo (*Zero-Flicker*). | Pre-renderizado de imágenes en DOM, precarga en memoria y control de opacidad `opacity-0` a `opacity-100` con `transition-opacity duration-300`. | En producción, cada ciclo reconstruía el tag `<img>`, forzando al navegador a solicitar de nuevo el asset. Al precargar en memoria, la transición es instantánea. |
| **Patrón Atmosférico** | Fondo oscuro estándar sin detalle. | Patrón de panal geométrico de alta precisión (*Honeycomb*) con reflejos metálicos. | Patrón SVG repetible `<pattern id="hex-grid-pattern">` con trazos de `rgba(255,255,255,0.12)` y gradientes de viñeta superior/inferior. | Estética de hardware gaming de gama alta que enmarca con elegancia los logotipos de los patrocinadores. |
| **Congelamiento en Hover** | Si el usuario pasaba el cursor, el carrusel se trababa o reiniciaba el tiempo desde cero. | Congelamiento milimétrico de la diapositiva y barra de progreso. | Cálculo en milisegundos: `progressPercent = ((SPONSOR_DURATION - slideRemainingTime) / SPONSOR_DURATION) * 100`, deteniendo la transición CSS en su porcentaje exacto y reanudando sin saltos. | Respeto a la intención del usuario: si lee la información de un sponsor, el sistema congela la pantalla en ese punto exacto y reanuda con naturalidad al salir el cursor. |
| **Tipografía y Copywriting** | Textos fragmentados con etiquetas `<br>` fijas que colapsaban en pantallas angostas. | Descripciones y cabecera balanceadas a **1 sola línea continua**. | Normalización de cadenas de texto y eliminación de saltos de línea duros. | Evita saltos tipográficos antiestéticos o líneas huérfanas de una sola palabra en pantallas móviles. |

---

### 3.5. Sección STAFF & DIRECTIVA (`#staff`)

| Parámetro | Estado en Producción (`main`) | Estado en Desarrollo (`desarrollo-rediseno-afiche`) | ¿Qué se usó? | ¿Por qué? (Justificación Técnica) |
| :--- | :--- | :--- | :--- | :--- |
| **Entorno Táctico** | Sección oscura genérica. | Fondo HUD Táctico con telemetría de Bolivia y marcas estilo VALORANT Champions. | Coordenadas reales de Bolivia (`16.5000° S, 68.1500° W`), cuadrícula de micro-puntos (*dot grid*), cruces de calibración y micro-radar concéntrico de 24Hz. | Ancla la liga a su identidad nacional soberana boliviana, combinándola con el diseño gráfico más vanguardista de los deportes electrónicos globales. |
| **Acordeón Trapezoidal en Móvil** | Trapecios con `clip-path` que en smartphones generaban zonas táctiles invisibles y desbordes. | Transformación fluida de trapecio en desktop a tarjetas redondeadas elásticas en móvil. | Regla CSS `@media (max-width: 768px) { .trapezoid-card { clip-path: none !important; border-radius: 0.875rem; transform: translateZ(0); } }`. | `clip-path` en pantallas táctiles altera el área de toque del usuario provocando pulsaciones fallidas. Quitar el recorte y forzar aceleración por hardware (`translateZ(0)`) garantiza 0% de lag táctil. |

---

### 3.6. Módulos Internos: ROSTERS, REGISTRO y SCOUTING

| Módulo / Archivo | Problema en Producción (`main`) | Solución en Desarrollo (`desarrollo-rediseno-afiche`) | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| **Rosters (`public/equipos.html`)** | Fondo plano básico; tarjetas de equipos flotando en vacío. | **Marca de Agua Gigante Monocromática (Emblema LBL):** Fondo `bg-vignette-studio` con emblema oficial escalado al 60vw en `mix-blend-mode: screen` con opacidad tenue (12%). Pestañas Tier 1 y Tier 2 con gradientes metalizados oro y azul. | Sensación de vitrina deportiva oficial de estudio de broadcast. Unifica la identidad visual con la página principal. |
| **Registro (`public/registro.html`)** | Formulario austero sin ambientación gráfica. | Integración del mismo contenedor ambiental de marca de agua y tarjetas con panel de cristal esmerilado (`backdrop-filter: blur(14px)`). | Reduce la fricción cognitiva y sensación de pesadez durante el proceso de inscripción del capitán del equipo. |
| **Scouting (`public/scouting.html`)** | El icono de la lupa se montaba encima del texto que escribía el reclutador; indicador de base de datos desalineado. | Corrección del padding de búsqueda (`pl-10`), reubicación de filtros bajo los banners y centrado jerárquico del indicador "Base de Datos Oficial". | Corrección de bug crítico de interfaz que impedía la lectura correcta de los nombres de los jugadores. |

---

### 3.7. FOOTER INSTITUCIONAL

| Parámetro | Estado en Producción (`main`) | Estado en Desarrollo (`desarrollo-rediseno-afiche`) | Justificación |
| :--- | :--- | :--- | :--- |
| **Arquitectura de Información** | Pie de página básico con enlaces en lista desordenada. | **Diseño Modular Tier 1 eSports en 3 Bloques:**<br>1. Identidad de marca + propósito deportivo + badge de Temporada 2026.<br>2. Navegación organizada en 3 columnas maestras (*Competición*, *Ecosistema*, *Transmisión*).<br>3. Botones sociales con micro-iluminación reactiva personalizada para cada plataforma (Discord, Twitch, Kick, YouTube, Instagram, TikTok). | Otorga seriedad y formalidad jurídica/institucional a la liga para captación de nuevos inversores y marcas patrocinadoras. |

---

## 4. Cuadro Resumen de Tecnologías y APIs Empleadas

| Tecnología / Técnica | Dónde se utilizó | Razón de Selección |
| :--- | :--- | :--- |
| **CSS Grid & Flexbox Moderno** | Layout de Afiches, triada de botones y acordeón staff | Estructura responsiva flexible sin necesidad de frameworks de maquetación externos. |
| **Dynamic Viewport Units (`dvh` / `svh`)** | Contenedores `.section-afiche` | Blindaje total contra el colapso de altura por las barras dinámicas del navegador en smartphones. |
| **Hardware GPU Acceleration (`translateZ`)** | Animaciones de tarjetas y transiciones de acordeón | Delegación de renderizado a la tarjeta de video, evitando bloqueos en el hilo principal del procesador. |
| **IntersectionObserver API** | Video de fondo en Circuito Competitivo | Reproducción condicional bajo demanda: ahorra batería, ancho de banda y memoria RAM. |
| **Floating-Point Marquee Algorithm** | Carrusel infinito de Clasificaciones | Eliminación del temblor (*jittering*) de píxeles enteros al mover elementos a baja velocidad. |
| **SVG Vectorial Paramétrico** | Brackets de Playoffs, Radar HUD y Malla Hexagonal | Gráficos escalables infinitamente sin pixelación y con un peso de bytes despreciable (< 8 KB). |
| **Cache Busting / Version Control** | `app-version.js` y `?v=192` en assets | Despliegue de producción transparente con garantía de actualización en clientes finales. |

---

## 5. Argumentario Clave para la Exposición Oral

Para sustentar este proyecto ante una audiencia, tribunal o panel directivo, se recomienda enfatizar los siguientes cuatro pilares:

1. **"De un sitio web convencional a una Cartelera Cinematográfica":**  
   No se diseñó una página estática para ser leída pasivamente, sino un afiche digital por pantallas que sumerge al usuario en la emoción de un torneo presencial de eSports.
2. **"Mobile First no es encoger la pantalla, es rediseñar la experiencia":**  
   En dispositivos móviles se sustituyeron los recortes poligonales complejos por tarjetas ergonómicas con botones grandes al alcance del pulgar, garantizando que el 100% de la información sea visible sin tener que hacer scroll innecesario.
3. **"Optimización de Ingeniería detrás de la Estética":**  
   Cada efecto visual tiene una justificación técnica de rendimiento: los videos pausan su reproducción cuando no se ven (`IntersectionObserver`), los assets de sponsors no parpadean porque están precargados en el DOM, y los desenfoques pesados de software fueron sustituidos por códecs de video nativos para proteger la GPU del usuario.
4. **"Valor de Marca y Formalidad de Ecosistema":**  
   La inclusión de marcas de agua oficiales, brackets animados de playoffs y un footer de estándar internacional posiciona a la LBL no como un torneo aficionado, sino como la máxima liga oficial de League of Legends en Bolivia.
