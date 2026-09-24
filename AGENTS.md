# Reglas de Proyecto y Directrices del Asistente (LBL eSports)

## 1. Edición Directa y Eficiencia (Cero Scripts Auxiliares)
- **Modificación directa:** Prioriza siempre la edición quirúrgica y directa de los archivos fuente del proyecto (`replace_file_content` o `write_to_file`).
- **Prohibición de scripts temporales:** Queda estrictamente prohibido crear scripts temporales o de diagnóstico (en Python, Node, PowerShell, etc.) para tareas de inspección de texto, conteo de líneas, verificación de sintaxis o manipulación de código. Usa directamente las herramientas del editor sobre el archivo fuente original.
- **Acción inmediata:** Ante peticiones de cambios de diseño, estilos, copywriting o lógica puntual, aplica la modificación de inmediato sin análisis redundantes.

## 2. Prevención de Parálisis por Análisis
- Si una tarea o comando anterior fue cancelado o detenido, **no** sobreanalices el estado del entorno ni intentes diagnósticos complejos. Retoma directamente la instrucción del usuario con agilidad.
- Mantén las respuestas claras, concisas y orientadas a la acción. No generes planes complejos para cambios puntuales.

## 3. Entorno Local y Herramientas del Proyecto
- Para estilos: compilar directamente con `npm run build:css`.
- Para pruebas locales: levantar el servidor con `npm run dev` (puerto 8000).
- Conservar la política de caché para producción (`?v=XXX` y `app-version.js`).
