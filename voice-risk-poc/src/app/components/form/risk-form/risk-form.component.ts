import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { GeolocationService } from '../../../services/geolocation.service';
import { NavigationService } from '../../../services/navigation.service';
import { StorageService } from '../../../services/storage.service';
import { NotificationService } from '../../../services/notification.service';
import { AudioCaptureService } from '../../../services/audio-capture.service';
import {
  RiskReport,
  RISK_TYPE_CATALOG,
  RISK_LEVEL_CATALOG,
  RISK_STATUS_CATALOG,
  RISK_REPORTER_CATALOG,
  RISK_COORDINATE_CATALOG,
} from '../../interfaces/risk.models';

interface RiskResponse {
  risk_type: string;
  risk_level: string;
  title: string;
  description: string;
  event_datetime: string;
  report_summary: string;
}

type FormMode = 'selection' | 'manual' | 'voice';
type VoiceState = 'idle' | 'listening' | 'processing' | 'result';

@Component({
  selector: 'app-risk-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- (Mantén tu template HTML exactamente igual, no cambia) -->
    <div class="form-container">
      <div class="form-header">
        <button class="btn-back" (click)="goBack()">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1>📝 Nuevo Reporte</h1>
        <div class="status-badge" [class.online]="isOnline" [class.offline]="!isOnline">
          {{ isOnline ? '🟢 Online' : '🔴 Offline' }}
        </div>
      </div>

      <!-- SELECCIÓN DE MODO -->
      <div *ngIf="mode === 'selection'" class="mode-selection">
        <h3>¿Cómo deseas crear el reporte?</h3>
        <div class="mode-cards">
          <button class="mode-card manual" (click)="setMode('manual')">
            <div class="icon">⌨️</div>
            <h4>Formulario Manual</h4>
            <p>Diligencia todos los campos detalladamente.</p>
          </button>
          <button class="mode-card voice" (click)="setMode('voice')" [disabled]="!isOnline">
            <div class="icon">🎙️</div>
            <h4>Asistente de Voz IA</h4>
            <p *ngIf="isOnline">Describe la situación y la IA llenará los datos.</p>
            <p *ngIf="!isOnline" class="offline-warning">⚠️ Requiere conexión a internet</p>
          </button>
        </div>
      </div>

      <!-- MODO MANUAL -->
      <div *ngIf="mode === 'manual'" class="form-card fade-in">
        <div class="location-info" *ngIf="coordinates">
          <span>📍 {{ address || 'Obteniendo ubicación...' }}</span>
        </div>
        <form (ngSubmit)="submitManualReport()" class="risk-form">
          <div class="form-group">
            <label>Tipo de Riesgo *</label>
            <select [(ngModel)]="formData.risk_type" name="risk_type" required>
              <option value="">Seleccionar...</option>
              <option value="Invasión Territorial">Invasión Territorial</option>
              <option value="Ocupación del Espacio Público">Ocupación del Espacio Público</option>
              <option value="Riesgo Ambiental">Riesgo Ambiental</option>
              <option value="Riesgo de Infraestructura">Riesgo de Infraestructura</option>
              <option value="Riesgo Sanitario">Riesgo Sanitario</option>
              <option value="Riesgo de Seguridad">Riesgo de Seguridad</option>
            </select>
          </div>
          <div class="form-group">
            <label>Nivel de Riesgo *</label>
            <select [(ngModel)]="formData.risk_level" name="risk_level" required>
              <option value="">Seleccionar...</option>
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
              <option value="Crítico">Crítico</option>
            </select>
          </div>
          <div class="form-group">
            <label>Título *</label>
            <input
              type="text"
              [(ngModel)]="formData.title"
              name="title"
              placeholder="Ej: Invasión en espacio público"
              required
            />
          </div>
          <div class="form-group">
            <label>Descripción detallada *</label>
            <textarea
              [(ngModel)]="formData.description"
              name="description"
              rows="4"
              placeholder="Describe la situación..."
              required
            ></textarea>
          </div>
          <button type="submit" class="btn-submit" [disabled]="isSubmitting || !isFormValid()">
            {{
              isSubmitting
                ? 'Procesando...'
                : isOnline
                  ? '📤 Enviar Reporte'
                  : '💾 Guardar Localmente'
            }}
          </button>
        </form>
      </div>

      <!-- MODO VOZ (IA) -->
      <div *ngIf="mode === 'voice'" class="voice-container fade-in">
        <div *ngIf="voiceState === 'idle'" class="voice-state idle">
          <div class="mic-icon-large">🎙️</div>
          <h3>Asistente de Voz Activo</h3>
          <p>Presiona el botón y describe el riesgo con tus propias palabras.</p>
          <button class="btn-start-voice" (click)="startVoiceRecognition()">
            <span class="pulse-ring"></span>
            Comenzar a Hablar
          </button>
        </div>

        <div *ngIf="voiceState === 'listening'" class="voice-state listening">
          <div class="listening-animation">
            <div class="wave"></div>
            <div class="wave"></div>
            <div class="wave"></div>
          </div>
          <h3>Escuchando y Grabando...</h3>
          <p>Habla claro y describe la ubicación y el problema.</p>
          <button class="btn-stop-voice" (click)="stopVoiceRecognition()">
            ⏹️ Detener Grabación
          </button>
        </div>

        <div *ngIf="voiceState === 'processing'" class="voice-state processing">
          <div class="spinner"></div>
          <h3>Procesando audio con IA...</h3>
        </div>

        <div *ngIf="voiceState === 'result'" class="voice-state result">
          <h3>✅ Texto Capturado</h3>
          <div class="transcript-box">
            <p>"{{ transcript }}"</p>
          </div>
          <div class="voice-actions">
            <button class="btn-cancel" (click)="resetVoice()">❌ Descartar</button>
            <button class="btn-confirm" (click)="submitVoiceReport()" [disabled]="isSubmitting">
              {{ isSubmitting ? 'Enviando...' : '✅ Confirmar y Enviar' }}
            </button>
          </div>
        </div>

        <div
          *ngIf="errorMessage"
          class="message-box"
          [class.error]="errorMessage.includes('Error')"
          [class.success]="errorMessage.includes('✅')"
        >
          {{ errorMessage }}
        </div>
      </div>

      <!-- Resultado del Backend (Compartido) -->
      <div *ngIf="backendResult" class="result-box fade-in">
        <h3>📊 Análisis del Sistema</h3>
        <div class="result-item"><strong>Título:</strong> {{ backendResult.title }}</div>
        <div class="result-item">
          <strong>Tipo:</strong> <span class="badge">{{ backendResult.risk_type }}</span>
        </div>
        <div class="result-item">
          <strong>Nivel:</strong>
          <span class="badge level-{{ backendResult.risk_level.toLowerCase() }}">{{
            backendResult.risk_level
          }}</span>
        </div>
        <div class="result-item"><strong>Resumen:</strong> {{ backendResult.report_summary }}</div>
        <button class="btn-submit" (click)="resetAll()">Crear Otro Reporte</button>
      </div>
    </div>
  `,
  styles: [
    /* (Mantén tus estilos CSS exactos aquí, no cambian) */
    `
      .form-container {
        max-width: 700px;
        margin: 0 auto;
        padding: 1rem;
      }
      .form-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .btn-back {
        background: white;
        border: 1px solid #e2e8f0;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .btn-back:hover {
        background: #f8fafc;
        color: #2563eb;
        transform: translateX(-3px);
      }
      .form-header h1 {
        flex: 1;
        margin: 0;
        font-size: 1.5rem;
        color: #1e293b;
      }
      .status-badge {
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 13px;
      }
      .status-badge.online {
        background: #dcfce7;
        color: #166534;
      }
      .status-badge.offline {
        background: #fee2e2;
        color: #991b1b;
      }
      .mode-selection h3 {
        text-align: center;
        color: #475569;
        margin-bottom: 1.5rem;
      }
      .mode-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
      }
      .mode-card {
        border: 2px solid #e2e8f0;
        border-radius: 16px;
        padding: 2rem;
        background: white;
        cursor: pointer;
        transition: all 0.3s;
        text-align: center;
      }
      .mode-card:hover:not(:disabled) {
        border-color: #3b82f6;
        transform: translateY(-4px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
      }
      .mode-card:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: #f8fafc;
      }
      .mode-card .icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      .mode-card h4 {
        margin: 0 0 0.5rem 0;
        color: #1e293b;
      }
      .mode-card p {
        margin: 0;
        color: #64748b;
        font-size: 14px;
      }
      .offline-warning {
        color: #ef4444 !important;
        font-weight: 600;
      }
      .form-card {
        background: white;
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      }
      .location-info {
        background: #f0f9ff;
        padding: 0.75rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        font-size: 14px;
        color: #0369a1;
        border-left: 4px solid #3b82f6;
      }
      .risk-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #475569;
        font-size: 14px;
      }
      .form-group input,
      .form-group select,
      .form-group textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 15px;
        font-family: inherit;
        box-sizing: border-box;
      }
      .form-group input:focus,
      .form-group select:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      .btn-submit {
        width: 100%;
        padding: 1rem;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 1rem;
      }
      .btn-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .voice-container {
        background: white;
        border-radius: 16px;
        padding: 3rem 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        text-align: center;
      }
      .voice-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      .mic-icon-large {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      .btn-start-voice {
        position: relative;
        padding: 1rem 2.5rem;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 50px;
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
        margin-top: 1rem;
      }
      .pulse-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        border-radius: 50px;
        border: 3px solid #ef4444;
        animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
      }
      @keyframes pulse-ring {
        0% {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 0.8;
        }
        100% {
          transform: translate(-50%, -50%) scale(1.5);
          opacity: 0;
        }
      }
      .listening-animation {
        display: flex;
        gap: 8px;
        align-items: center;
        height: 60px;
        margin-bottom: 1rem;
      }
      .wave {
        width: 8px;
        background: #3b82f6;
        border-radius: 4px;
        animation: wave 1s ease-in-out infinite;
      }
      .wave:nth-child(1) {
        height: 20px;
        animation-delay: 0s;
      }
      .wave:nth-child(2) {
        height: 40px;
        animation-delay: 0.1s;
      }
      .wave:nth-child(3) {
        height: 30px;
        animation-delay: 0.2s;
      }
      @keyframes wave {
        0%,
        100% {
          transform: scaleY(0.5);
        }
        50% {
          transform: scaleY(1.5);
        }
      }
      .btn-stop-voice {
        padding: 0.75rem 2rem;
        background: #1e293b;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      }
      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #e2e8f0;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .transcript-box {
        background: #f8fafc;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.5rem;
        margin: 1rem 0;
        text-align: left;
        font-size: 16px;
        line-height: 1.6;
        color: #334155;
        width: 100%;
        box-sizing: border-box;
      }
      .voice-actions {
        display: flex;
        gap: 1rem;
        width: 100%;
        margin-top: 1rem;
      }
      .btn-cancel {
        flex: 1;
        padding: 1rem;
        background: #f1f5f9;
        color: #475569;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-confirm {
        flex: 2;
        padding: 1rem;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 16px;
      }
      .btn-confirm:disabled {
        opacity: 0.6;
      }
      .result-box {
        margin-top: 2rem;
        padding: 1.5rem;
        background: #f0fdf4;
        border-radius: 12px;
        border: 1px solid #bbf7d0;
        text-align: left;
      }
      .result-item {
        margin-bottom: 0.75rem;
      }
      .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 700;
        background: #e2e8f0;
        color: #475569;
      }
      .level-alto,
      .level-crítico {
        background: #fecaca;
        color: #991b1b;
      }
      .level-medio {
        background: #fef08a;
        color: #854d0e;
      }
      .level-bajo {
        background: #bbf7d0;
        color: #166534;
      }
      .message-box {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 8px;
        font-weight: 500;
      }
      .message-box.error {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
      .message-box.success {
        background: #f0fdf4;
        color: #166534;
        border: 1px solid #bbf7d0;
      }
      .fade-in {
        animation: fadeIn 0.4s ease-out;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (max-width: 600px) {
        .mode-cards {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RiskFormComponent implements OnInit, OnDestroy {
  isOnline = true;
  isSubmitting = false;
  errorMessage = '';
  backendResult: RiskResponse | null = null;

  mode: FormMode = 'selection';
  voiceState: VoiceState = 'idle';
  transcript = '';
  capturedAudioBase64 = '';

  coordinates: { lat: number; lng: number } | null = null;
  address = '';

  formData = { risk_type: '', risk_level: '', title: '', description: '' };

  private recognition: any;
  private connectivityInterval: any;
  private navSubscription: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private navService: NavigationService,
    private storageService: StorageService,
    private geoService: GeolocationService,
    private notificationService: NotificationService,
    private audioService: AudioCaptureService, // 🆕 Nuevo servicio
  ) {}

  async ngOnInit() {
    this.checkConnectivity();
    this.connectivityInterval = setInterval(() => this.checkConnectivity(), 5000);
    this.initSpeechRecognition();

    this.navSubscription = this.navService.prefillData$.subscribe(async (data) => {
      if (data?.coords) {
        this.coordinates = data.coords;
        const geoData = await this.geoService.getAddressFromCoords(
          data.coords.lat,
          data.coords.lng,
        );
        this.address = `${geoData.comuna}, ${geoData.barrio} - ${geoData.address}`;
      } else {
        try {
          this.coordinates = await this.geoService.getCurrentPosition();
          const geoData = await this.geoService.getAddressFromCoords(
            this.coordinates.lat,
            this.coordinates.lng,
          );
          this.address = `${geoData.comuna}, ${geoData.barrio} - ${geoData.address}`;
        } catch (e) {
          this.address = 'Ubicación no disponible';
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.connectivityInterval) clearInterval(this.connectivityInterval);
    if (this.recognition) this.recognition.abort();
    if (this.navSubscription) this.navSubscription.unsubscribe();
    this.navService.clearPrefillData();
  }

  private checkConnectivity() {
    fetch('https://clients3.google.com/generate_204', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
    })
      .then(() => (this.isOnline = true))
      .catch(() => {
        this.isOnline = false;
        if (this.mode === 'voice') this.mode = 'selection';
      });
  }

  setMode(newMode: FormMode) {
    if (newMode === 'voice' && !this.isOnline) return;
    this.mode = newMode;
    this.errorMessage = '';
    this.backendResult = null;
  }

  goBack() {
    this.navService.navigateTo('home');
  }

  // --- LÓGICA DE VOZ ACTUALIZADA ---
  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-CO';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        this.transcript = event.results[0][0].transcript;
      };
      this.recognition.onerror = (event: any) => {
        this.errorMessage = 'Error en el reconocimiento: ' + event.error;
        this.voiceState = 'idle';
      };
      this.recognition.onend = () => {
        if (this.voiceState === 'listening') this.voiceState = 'idle';
      };
    } else {
      this.errorMessage = 'Tu navegador no soporta la API de voz.';
    }
  }

  async startVoiceRecognition() {
    this.errorMessage = '';
    this.transcript = '';
    this.capturedAudioBase64 = '';
    this.voiceState = 'listening';

    try {
      // 1. Iniciar grabación de audio real (para IndexedDB)
      await this.audioService.startRecording();
      // 2. Iniciar reconocimiento de texto (para la UI)
      if (this.recognition) this.recognition.start();
    } catch (e) {
      this.errorMessage = 'No se pudo acceder al micrófono.';
      this.voiceState = 'idle';
    }
  }

  async stopVoiceRecognition() {
    if (this.recognition) this.recognition.stop();

    try {
      console.log('🎙️ [IA] Deteniendo grabación y procesando audio...');
      this.capturedAudioBase64 = await this.audioService.stopRecording();

      // 🆕 LOG CLAVE PARA VALIDAR EL AUDIO
      console.log(
        '✅ [IA] Audio capturado exitosamente. Longitud del Base64:',
        this.capturedAudioBase64.length,
      );
      console.log(
        '🔍 [IA] Muestra del Base64 (primeros 50 chars):',
        this.capturedAudioBase64.substring(0, 50) + '...',
      );

      this.voiceState = 'processing';

      setTimeout(() => {
        this.voiceState = 'result';
      }, 1500);
    } catch (e) {
      console.error('❌ [IA] Error al procesar el audio:', e);
      this.errorMessage = 'Error al procesar el audio.';
      this.voiceState = 'idle';
    }
  }

  resetVoice() {
    this.voiceState = 'idle';
    this.transcript = '';
    this.capturedAudioBase64 = '';
    this.errorMessage = '';
  }

  async submitVoiceReport() {
    this.isSubmitting = true;
    console.log('📝 [IA] Iniciando envío de reporte de voz...');
    try {
      const payload = { message: { text: this.transcript, type: 'text' } };
      const url =
        'https://min-ai-dev-dev-n8n-main.happypebble-84155d3f.eastus2.azurecontainerapps.io/webhook/risk-ai';
      const headers = new HttpHeaders({
        Authentication: 'Bearer apsd8jfa8p98rj3p239jklds',
        'Content-Type': 'application/json',
      });

      const response = await firstValueFrom(this.http.post<any>(url, payload, { headers }));
      console.log('✅ [IA] Respuesta del backend:', response);

      await this.saveReportToStorage({
        isIA: true,
        transcript: this.transcript,
        audioBase64: this.capturedAudioBase64,
        backendResponse: response,
        status: 'synced',
      });

      this.backendResult = response;
      this.notificationService.success(
        '✅ Reporte Enviado',
        'El reporte fue procesado exitosamente',
      );
      this.mode = 'selection';
    } catch (error) {
      console.error('❌ [IA] ERROR al enviar a IA, guardando para reintento:', error);

      await this.saveReportToStorage({
        isIA: true,
        transcript: this.transcript,
        audioBase64: this.capturedAudioBase64,
        backendResponse: null,
        status: 'retry_ia',
      });

      this.notificationService.info(
        '💾 Guardado para Reintento IA',
        'Se procesará con IA cuando haya conexión',
      );
      setTimeout(() => {
        this.mode = 'selection';
      }, 2000);
    } finally {
      this.isSubmitting = false;
    }
  }

  // --- LÓGICA MANUAL ---
  isFormValid(): boolean {
    return !!(
      this.formData.risk_type &&
      this.formData.risk_level &&
      this.formData.title.trim() &&
      this.formData.description.trim()
    );
  }

  async submitManualReport() {
    this.isSubmitting = true;
    console.log('📝 [MANUAL] Iniciando envío de reporte manual...');
    console.log('📍 Coordenadas actuales:', this.coordinates);
    console.log('🏠 Dirección:', this.address);
    console.log('📋 Datos del formulario:', this.formData);

    try {
      // Si no hay coordenadas, intentamos obtenerlas una última vez antes de guardar
      let coordsToSave = this.coordinates;
      let addressToSave = this.address;

      if (!coordsToSave) {
        console.warn('⚠️ [MANUAL] No hay coordenadas, intentando obtenerlas...');
        try {
          coordsToSave = await this.geoService.getCurrentPosition();
          const geoData = await this.geoService.getAddressFromCoords(
            coordsToSave.lat,
            coordsToSave.lng,
          );
          addressToSave = `${geoData.comuna}, ${geoData.barrio} - ${geoData.address}`;
        } catch (geoError) {
          console.error('❌ [MANUAL] No se pudo obtener la ubicación:', geoError);
          coordsToSave = { lat: 0, lng: 0 };
          addressToSave = 'Ubicación no disponible';
        }
      }

      if (this.isOnline) {
        const payload = {
          message: { text: this.formData.description, type: 'text' },
          risk_type: this.formData.risk_type,
          risk_level: this.formData.risk_level,
        };
        const url =
          'https://min-ai-dev-dev-n8n-main.happypebble-84155d3f.eastus2.azurecontainerapps.io/webhook/risk-ai';
        const headers = new HttpHeaders({
          Authentication: 'Bearer apsd8jfa8p98rj3p239jklds',
          'Content-Type': 'application/json',
        });

        console.log('📤 [MANUAL] Enviando petición al backend...');
        const response = await firstValueFrom(this.http.post<any>(url, payload, { headers }));
        console.log('✅ [MANUAL] Respuesta del backend:', response);

        await this.saveReportToStorage({
          isIA: false,
          transcript: '',
          backendResponse: response,
          status: 'synced',
          coordsOverride: coordsToSave,
          addressOverride: addressToSave,
        });

        this.backendResult = response;
        this.notificationService.success(
          '✅ Reporte Enviado',
          'El reporte fue procesado exitosamente',
        );
      } else {
        console.log('💾 [MANUAL] Sin conexión. Guardando localmente...');
        await this.saveReportToStorage({
          isIA: false,
          transcript: '',
          backendResponse: null,
          status: 'pending',
          coordsOverride: coordsToSave,
          addressOverride: addressToSave,
        });
        this.notificationService.info(
          '💾 Guardado Localmente',
          'Se enviará automáticamente cuando haya conexión',
        );
      }
      this.resetForm();
    } catch (error) {
      console.error('❌ [MANUAL] ERROR DETALLADO al enviar/guardar:', error);

      // Intentar guardar localmente incluso si falló todo lo demás
      try {
        await this.saveReportToStorage({
          isIA: false,
          transcript: '',
          backendResponse: null,
          status: 'error',
          coordsOverride: this.coordinates || { lat: 0, lng: 0 },
          addressOverride: this.address || 'Error al obtener dirección',
        });
      } catch (saveError) {
        console.error('❌ [MANUAL] FALLO CRÍTICO al guardar en IndexedDB:', saveError);
      }

      this.notificationService.error(
        '❌ Error',
        'No se pudo enviar el reporte. Se guardó localmente.',
      );
    } finally {
      this.isSubmitting = false;
    }
  }

  // --- MÉTODO UNIFICADO DE GUARDADO ---
  private async saveReportToStorage(data: {
    isIA: boolean;
    transcript: string;
    audioBase64?: string;
    backendResponse: any;
    status: 'synced' | 'pending' | 'error' | 'retry_ia';
    coordsOverride?: { lat: number; lng: number };
    addressOverride?: string;
  }) {
    const rawRiskType = data.backendResponse?.risk_type || this.formData.risk_type;
    const rawRiskLevel = data.backendResponse?.risk_level || this.formData.risk_level;

    const riskTypeKey = this.getRiskTypeKey(rawRiskType);
    const riskLevelKey = this.getRiskLevelKey(rawRiskLevel);

    // Usar coordenadas sobrescritas (del intento de rescate) o las de la clase
    const coords = data.coordsOverride || this.coordinates || { lat: 0, lng: 0 };
    const address = data.addressOverride || this.address || 'Dirección no disponible';

    const newReport: RiskReport = {
      id: this.generateUUID(),
      risk_type_id: RISK_TYPE_CATALOG[riskTypeKey].id,
      risk_status_id: RISK_STATUS_CATALOG.REPORTED.id,
      risk_level_id: RISK_LEVEL_CATALOG[riskLevelKey].id,
      risk_type_reporter_id: data.isIA
        ? RISK_REPORTER_CATALOG.ASSISTANT.id
        : RISK_REPORTER_CATALOG.FORM.id,
      risk_type_coordinate_id: RISK_COORDINATE_CATALOG.POINT.id,

      title: data.backendResponse?.title || this.formData.title || 'Reporte de Riesgo',
      description:
        data.backendResponse?.description || this.formData.description || data.transcript,
      latitude: coords.lat,
      longitude: coords.lng,
      jsonCoordinate: [{ latitude: coords.lat, longitude: coords.lng }],
      direccion: address,

      user: 'user-demo-001',
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),

      sync_status: data.status,
      backend_response: data.backendResponse,
    };

    if (data.isIA) {
      newReport.audio_url = data.audioBase64;
      newReport.ia_process = {
        original_audio: data.audioBase64,
        transcript: data.transcript,
        ia_response: data.backendResponse,
        retry_count: data.status === 'retry_ia' ? 1 : 0,
      };
    }

    // 🆕 LOG CLAVE: Mostrar el JSON exacto que se va a guardar en IndexedDB
    console.log(
      '💾 [STORAGE] JSON FINAL a guardar en IndexedDB:',
      JSON.parse(JSON.stringify(newReport)),
    );

    try {
      await this.storageService.saveReport(newReport);
      console.log('✅ [STORAGE] Reporte guardado exitosamente en IndexedDB.');
    } catch (storageError) {
      console.error('❌ [STORAGE] Error crítico al guardar en IndexedDB:', storageError);
      throw storageError;
    }
  }

  // --- UTILIDADES ---
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16) + Date.now().toString(16);
    });
  }

  private getRiskTypeKey(name: string): keyof typeof RISK_TYPE_CATALOG {
    if (!name) return 'INVASION_TERRITORIAL';
    const normalizedName = name.trim().toLowerCase();

    // Búsqueda tolerante a mayúsculas/minúsculas y acentos
    const map: Record<string, keyof typeof RISK_TYPE_CATALOG> = {
      'invasión territorial': 'INVASION_TERRITORIAL',
      'invasion territorial': 'INVASION_TERRITORIAL',
      'invasión zona protegida': 'INVASION_ZONA_PROTEGIDA',
      'ocupación del espacio público': 'OCUPACION_ESPACIO_PUBLICO',
      'ocupacion del espacio publico': 'OCUPACION_ESPACIO_PUBLICO',
      'riesgo ambiental': 'RIESGO_AMBIENTAL',
      'riesgo de infraestructura': 'RIESGO_INFRAESTRUCTURA',
      'riesgo de seguridad': 'RIESGO_SEGURIDAD',
      'riesgo sanitario': 'RIESGO_SANITARIO',
    };

    return map[normalizedName] || 'INVASION_TERRITORIAL';
  }

  private getRiskLevelKey(name: string): keyof typeof RISK_LEVEL_CATALOG {
    if (!name) return 'MEDIO';
    const normalizedName = name.trim().toLowerCase();

    const map: Record<string, keyof typeof RISK_LEVEL_CATALOG> = {
      bajo: 'BAJO',
      medio: 'MEDIO',
      alto: 'ALTO',
      crítico: 'CRITICO',
      critico: 'CRITICO',
    };

    return map[normalizedName] || 'MEDIO';
  }

  resetForm() {
    this.formData = { risk_type: '', risk_level: '', title: '', description: '' };
    this.backendResult = null;
  }

  resetAll() {
    this.backendResult = null;
    this.mode = 'selection';
    this.resetForm();
  }
}
