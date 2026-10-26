# Manual de Desarrollo y Guía Operativa: Overlay LBL eSports

Este documento contiene la arquitectura, flujo de trabajo, configuración y procedimientos necesarios para continuar el desarrollo, mantenimiento y operación del **Overlay de Transmisión LBL eSports** desde cualquier computadora o portátil.

---

## 1. Arquitectura del Sistema

El sistema de overlay se divide en tres componentes principales:

```
┌────────────────────────────────────────────────────────┐
│                   OBS STUDIO (1080p)                   │
│                                                        │
│  Fuente de Navegador: overlay-schedule.html            │
│  (Render visual: Schedule Worlds + Rotación Sponsors)  │
└───────────────────────────▲────────────────────────────┘
                            │ BroadcastChannel / Firestore
┌───────────────────────────┴────────────────────────────┐
│              PANEL DE CONTROL WEB                      │
│                                                        │
│  Controlador: overlay-control.html                     │
│  (Selector partidos, modos, sponsors, subida medios)  │
└───────────────────────────▲────────────────────────────┘
                            │ HTTP API (Uploads / Static)
┌───────────────────────────┴────────────────────────────┐
│              SERVIDOR LOCAL (NODE.JS)                  │
│                                                        │
│  dev-server.js (Puerto 8000)                           │
│  (Express + Multer para carga de flyers/videos)        │
└────────────────────────────────────────────────────────┘
```

### Archivos Principales
1. **`public/overlay-schedule.html`**:
   - Vista para OBS Studio (resolución nativa **1920x1080**).
   - **Header estilo Worlds**: Caja única limpia (`panel-header`), sin sub-cajas anidadas ("no caja sobre caja"). Fecha grande en rojo vibrante, logo oficial de Twitch (`DARKCITO` sin arroba) y badge de torneo LBL.
   - **Contenedor de Enfrentamientos**: Lista de matches en dos columnas con badges de horario destacados (`20:00`, `21:00`, etc.), estados en vivo (EN VIVO, FINALIZADO, PROXIMO) y escudos oficiales transparentes.
   - **Carrusel de Sponsors**: Rotación automática optimizada (cada 7s), con el orden y jerarquía visual de VOLT: logo a la izquierda (`h-[160px] w-[340px]`), punchline en mayúsculas y descripción legible (`text-lg font-medium text-zinc-200`) a la derecha, sin colisiones.
   - **Soporte de Medios Personalizados**: Capacidad de reproducir imágenes o videos subidos por el operador (flyers de productos, spots publicitarios).

2. **`public/overlay-control.html`**:
   - Consola web para el caster, director de stream u operador.
   - Permite seleccionar jornada, forzar partido en vivo, editar score, cambiar el canal de Twitch, activar pausas y subir flyers/videos directamente.

3. **`dev-server.js`**:
   - Servidor Node.js Express. Sirve archivos estáticos y gestiona el endpoint `/api/upload-media` para guardar imágenes/videos en `public/uploads/`.

4. **`public/assets/Equipos SC3/`**:
   - Repositorio de logos oficiales de equipos con fondo transparente en formato PNG.

---

## 2. Preparación del Entorno en una Portátil

### Requisitos Previos
- **Node.js**: Versión 18 o superior ([nodejs.org](https://nodejs.org/)).
- **Git**: Para control de versiones ([git-scm.com](https://git-scm.com/)).
- **Firebase CLI**: Para despliegues en producción.
  ```powershell
  npm install -g firebase-tools
  firebase login
  ```

### Pasos de Instalación
1. Clonar el repositorio:
   ```powershell
   git clone https://github.com/TheDarknight117/LBL-ESPORTS.git
   cd LBL-ESPORTS
   ```
2. Instalar dependencias del proyecto:
   ```powershell
   npm install
   ```

---

## 3. Flujo de Trabajo Local (Día a Día)

### Iniciar el Servidor de Desarrollo
Para levantar el servidor web local con soporte para subida de medios:
```powershell
npm run dev
```
El servidor quedará corriendo en:
- **Panel de Control**: `http://localhost:8000/overlay-control.html`
- **Overlay para OBS**: `http://localhost:8000/overlay-schedule.html?channel=darkcito`
- **Sitio Principal**: `http://localhost:8000/index.html`

### Compilación de Estilos (Tailwind CSS)
El proyecto utiliza Tailwind CSS con un archivo de entrada en `src/input.css` y salida compilada en `public/dist/output.css`.

- **Compilar una vez tras agregar nuevas clases de Tailwind**:
  ```powershell
  npm run build:css
  ```
- **Modo observador (Watch) durante diseño activo**:
  ```powershell
  npm run watch:css
  ```

> [!IMPORTANT]
> Cada vez que agregues clases de Tailwind que no existían previamente, debes ejecutar `npm run build:css`. Si solo editas lógica JavaScript o estilos en línea, no es necesario recompilar CSS.

---

## 4. Configuración en OBS Studio

Para integrar el overlay en tus escenas de OBS Studio:

1. En tu escena de OBS, agrega una fuente de tipo **Navegador (Browser Source)**.
2. Configura los siguientes parámetros:
   - **URL**:
     - *Desarrollo Local*: `http://localhost:8000/overlay-schedule.html?channel=darkcito`
     - *Producción*: `https://lbl-esports.web.app/overlay-schedule.html?channel=darkcito`
   - **Ancho (Width)**: `1920`
   - **Alto (Height)**: `1080`
   - **FPS**: `60`
   - **Controlar audio vía OBS**: Marcar casilla (recomendado si reproduces videos de sponsors con audio).
   - **Apagar la fuente cuando no sea visible**: Marcada.
   - **Actualizar el navegador cuando la escena se active**: Desmarcada (para evitar recargas bruscas durante la transmisión).

> [!TIP]
> Si haces cambios en vivo y OBS no los refleja de inmediato, abre las propiedades de la fuente en OBS y haz clic en el botón **"Actualizar la caché de la página actual"**.

---

## 5. Gestión de Logos de Equipos (Equipos SC3)

Todos los logos limpios y transparentes se ubican en:
`public/assets/Equipos SC3/`

### Sistema de Mapeo Inteligente
En `public/overlay-schedule.html` y `public/overlay-control.html`, la función `findLocalSc3Logo(teamName, teamTag)` resuelve el logo local de forma automática buscando por tag abreviado o por nombre del equipo.

#### Diferenciación de Equipos con Nombres Similares
- **NRE (NOX REIGN ESPORTS)**:
  - Archivo: `public/assets/Equipos SC3/NOX REIGN ESPORTS.png`
  - Tag: `NRE`
- **NRS (NEW RAPTURE SPORT)**:
  - Archivo: `public/assets/Equipos SC3/New Rapture Sport.png`
  - Tag: `NRS`
- **PLF / PCL (Pacha Lovers)**:
  - Archivo: `public/assets/Equipos SC3/Pacha Lovers.png`
  - Tags soportados: `PLF`, `PCL` (fondo transparente, sin caja negra).

### Cómo Agregar un Nuevo Logo
1. Guarda la imagen en formato **PNG con fondo transparente** dentro de `public/assets/Equipos SC3/`.
2. Si el nombre del archivo no coincide exactamente con el tag o nombre del equipo en el fixture, regístralo en el objeto `LOCAL_SC3_LOGOS` dentro de `overlay-schedule.html` y `overlay-control.html`:
   ```javascript
   const LOCAL_SC3_LOGOS = {
     // ...
     "tag_o_nombre_en_minusculas": "/assets/Equipos%20SC3/Nombre_Exacto_Archivo.png"
   };
   ```

---

## 6. Configuración de Patrocinadores (Sponsors)

Los sponsors rotan automáticamente cada 7 segundos respetando la jerarquía visual estándar definida para VOLT:

| Patrocinador | Tipo de Empresa | Punchline / Slogan | Contenido / Enfoque |
| :--- | :--- | :--- | :--- |
| **VOLT** | Bebida Energizante Oficial | `ENERGÍA QUE DEFINE CAMPEONES` | Impulso térmico, enfoque mental y potencia en cada partida. |
| **LEGION** | Hardware & Computadoras Gaming | `RENDIMIENTO EXTREMO Y HARDWARE DE ÉLITE` | Computadoras gaming, laptops de última generación, tarjetas gráficas y periféricos para esports. |
| **AQM (Aquimequedo)** | Esports LAN Center (La Paz) | `EL EPICENTRO DEL GAMING COMPETITIVO EN LA PAZ` | Estaciones de alto rendimiento, fibra óptica de baja latencia y el mejor ambiente gamer paceño. |
| **ICONIC** | Ropa Urbana & Streetwear | `EL ESTILO URBANO DE LA NUEVA GENERACIÓN` | Diseños exclusivos, cortes oversize y la identidad visual que viste a los campeones. |

### Carga de Medios Propios (Flyers / Videos)
Desde el panel de control (`overlay-control.html`), sección **"Patrocinadores & Medios"**:
1. Puedes seleccionar un archivo local (imagen JPG/PNG o video MP4/WebM).
2. El servidor lo subirá a `public/uploads/` y transmitirá la URL en tiempo real al overlay.
3. El overlay cambiará automáticamente a la vista de medio personalizado sin necesidad de reiniciar la transmisión.

---

## 7. Política de Caché y Buenas Prácticas

### Regla de Control de Caché (`?v=XXX`)
Para garantizar que los navegadores y OBS carguen siempre los archivos CSS y JS actualizados sin depender del caché del cliente:
- En `public/overlay-schedule.html` y `public/overlay-control.html`:
  ```html
  <link rel="stylesheet" href="/dist/output.css?v=230">
  <script src="/js/app-version.js?v=230"></script>
  ```
- Si realizas cambios estructurales en CSS o JS de cara a producción, incrementa el número de versión (por ejemplo, `?v=231`).

---

## 8. Despliegue en Producción y Control de Versiones

### Despliegue a Firebase Hosting
Para subir los cambios a la web pública de LBL eSports:
```powershell
firebase deploy --only hosting
```
Una vez finalizado, los cambios estarán disponibles de inmediato en:
- `https://lbl-esports.web.app/overlay-schedule.html?channel=darkcito`
- `https://lbl-esports.firebaseapp.com/overlay-schedule.html?channel=darkcito`

### Guardar y Subir a GitHub
```powershell
git add .
git commit -m "feat(overlay): estilo worlds, normalizacion de sponsors y logos sc3 transparentes"
git push origin main
```

---

## 9. Resolución de Problemas Comunes (FAQ)

| Problema | Causa Probable | Solución |
| :--- | :--- | :--- |
| **Las clases nuevas de CSS no se aplican en pantalla.** | No se ha recompilado Tailwind o el navegador tiene CSS en caché. | 1. Ejecuta `npm run build:css`.<br>2. Incrementa el parámetro `?v=...` en el HTML.<br>3. En OBS, haz clic en "Actualizar la caché de la página actual". |
| **Un logo de equipo aparece roto o con fondo negro.** | El archivo no está mapeado o se cargó desde la URL externa de Drive. | Revisa el tag del equipo en el fixture y verifica que esté registrado en `LOCAL_SC3_LOGOS` apuntando al archivo en `public/assets/Equipos SC3/`. |
| **El overlay no responde a los clics del panel de control.** | OBS y el panel están en navegadores o dominios separados sin Firebase activo. | Si usas servidor local, asegúrate de que ambos apunten a `localhost:8000` para que el `BroadcastChannel` sincronice instantáneamente. En redes distintas, verifica la conexión a internet para sincronización vía Firestore. |
| **Fallo al subir imágenes/videos desde el panel.** | El servidor Node (`dev-server.js`) no está corriendo. | Ejecuta `npm run dev` en una terminal de PowerShell. |
