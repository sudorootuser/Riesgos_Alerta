# 🛡️ Sistema de Reporte de Riesgos en Campo

Aplicación web progresiva (PWA) desarrollada en **Angular** para la captura, geolocalización y gestión de reportes de riesgos en campo. Diseñada con una arquitectura **Offline-First**, permite a los técnicos crear reportes mediante formulario manual o asistente de voz con IA, adjuntar evidencias multimedia y sincronizar los datos automáticamente al recuperar la conexión.

---

## 🛠️ Stack Tecnológico Principal

- **Framework:** Angular (Arquitectura de Componentes Standalone)
- **Lenguaje:** TypeScript
- **Estilos:** CSS3 (Diseño responsivo y animaciones personalizadas)

---

## 📦 Librerías y Herramientas Clave

| Librería / API | Propósito en el Proyecto |
| :--- | :--- |
| **`leaflet`** + `@types/leaflet` | Renderizado del mapa interactivo, marcadores, dibujo de polígonos (áreas de riesgo) y geolocalización del usuario. |
| **`localforage`** | Almacenamiento local robusto. Utiliza **IndexedDB** por debajo para guardar reportes completos, respuestas del backend y archivos en Base64, superando los límites de tamaño del `localStorage` tradicional. |
| **Web Speech API** (`SpeechRecognition`) | API nativa del navegador para la transcripción de **Voz a Texto** en tiempo real (es-CO), utilizada por el asistente de IA. |
| **Web Speech API** (`SpeechSynthesis`) | API nativa para **Texto a Voz (TTS)**, permitiendo escuchar el resumen del riesgo directamente desde el popup o modal del mapa. |
| **FileReader API** (Nativa JS) | Utilizada para leer archivos locales (imágenes, videos, audios, documentos) y convertirlos a formato **Base64** (`data:mime/type;base64,...`) para su almacenamiento y visualización offline. |
| **OpenStreetMap Nominatim** | Servicio de geocodificación inversa gratuito para obtener la dirección, comuna y barrio a partir de las coordenadas GPS capturadas. |
| **`sweetalert2`** | Gestión de notificaciones, alertas de éxito/error y modales de confirmación con una interfaz moderna y limpia. |
| **`rxjs`** | Manejo de flujos de datos reactivos, suscripciones a cambios de conectividad (`online`/`offline`) y navegación entre componentes. |

---

## ⚙️ Flujos Técnicos Destacados

### 1. Arquitectura Offline-First (Patrón Outbox)
- Los reportes creados sin internet se guardan en IndexedDB con el estado `pending` o `retry_ia`.
- Un `SyncService` escucha el evento `window.addEventListener('online')`. Al detectar conexión, procesa la cola de reportes pendientes, los envía al endpoint de la IA, fusiona la respuesta con los datos locales y actualiza el estado a `synced`.

### 2. Manejo de Evidencias Multimedia
- Las evidencias (Fotos, Videos, Audios, Documentos) se seleccionan mediante un `<input type="file">`.
- Se procesan con `FileReader.readAsDataURL()` para convertirlas a **Base64**.
- Se almacenan en un array `evidences` dentro del objeto `RiskReport` en IndexedDB, permitiendo su visualización posterior en modales dedicados sin necesidad de conexión.

### 3. Geolocalización y Dibujo Geoespacial
- Soporta dos modos de captura: 
  - **POINT:** Un único marcador con coordenadas `lat/lng`.
  - **POLYGON:** Múltiples vértices que, al cerrarse, generan un área rellena (`L.polygon` en Leaflet) con color semitransparente según el nivel de riesgo (Rojo=Alto, Naranja=Medio, Verde=Bajo).

### 4. Integración con IA (Voz)
- El audio se graba localmente usando `MediaRecorder` y se convierte a Base64.
- Simultáneamente, la Web Speech API transcribe el audio a texto.
- El texto se envía al webhook de la IA. Si hay éxito, se guarda la respuesta estructurada. Si falla, se guarda el estado `retry_ia` con el audio original adjunto para reintentar el procesamiento más tarde.

---

##  Instalación y Ejecución

1. **Clonar el repositorio** e instalar dependencias:
   ```bash
   npm install
   # Asegurar dependencias clave si no están en package.json:
   npm install leaflet localforage sweetalert2
   npm install -D @types/leaflet @types/localforage
