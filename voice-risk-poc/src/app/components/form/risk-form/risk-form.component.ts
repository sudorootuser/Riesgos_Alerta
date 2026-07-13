import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
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
  RiskEvidence,
  EVIDENCE_TYPE_CATALOG,
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
type ManualStep = 'data' | 'evidences';
type VoiceStep = 'idle' | 'listening' | 'processing' | 'result' | 'evidences';

@Component({
  selector: 'app-risk-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
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

      <!-- MODO MANUAL: PASO 1 -->
      <div *ngIf="mode === 'manual' && manualStep === 'data'" class="form-card fade-in">
        <div class="location-info" *ngIf="coordinates">
          <span>📍 {{ address || 'Obteniendo ubicación...' }}</span>
        </div>
        <form (ngSubmit)="goToEvidencesStep()" class="risk-form">
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
          <button type="submit" class="btn-submit" [disabled]="!isFormValid()">
            Siguiente: Adjuntar Evidencias ➡️
          </button>
        </form>
      </div>

      <!-- MODO VOZ -->
      <div *ngIf="mode === 'voice'" class="voice-container fade-in">
        <div *ngIf="voiceStep === 'idle' || voiceStep === 'listening'" class="voice-state">
          <div *ngIf="voiceStep === 'idle'" class="mic-icon-large">🎙️</div>
          <div *ngIf="voiceStep === 'listening'" class="listening-animation">
            <div class="wave"></div>
            <div class="wave"></div>
            <div class="wave"></div>
          </div>
          <h3>
            {{ voiceStep === 'idle' ? 'Asistente de Voz Activo' : 'Escuchando y Grabando...' }}
          </h3>
          <p>
            {{
              voiceStep === 'idle'
                ? 'Presiona el botón y describe el riesgo.'
                : 'Habla claro y describe la ubicación y el problema.'
            }}
          </p>

          <button
            *ngIf="voiceStep === 'idle'"
            class="btn-start-voice"
            (click)="startVoiceRecognition()"
          >
            <span class="pulse-ring"></span> Comenzar a Hablar
          </button>
          <button
            *ngIf="voiceStep === 'listening'"
            class="btn-stop-voice"
            (click)="stopVoiceRecognition()"
          >
            ⏹️ Detener Grabación
          </button>
        </div>

        <div *ngIf="voiceStep === 'processing'" class="voice-state">
          <div class="spinner"></div>
          <h3>Procesando audio con IA...</h3>
        </div>

        <div *ngIf="voiceStep === 'result'" class="voice-state result">
          <h3>✅ Análisis de IA Completado</h3>
          <div class="transcript-box">
            <p><strong>Resumen IA:</strong> {{ iaResult?.report_summary || transcript }}</p>
            <p><strong>Tipo detectado:</strong> {{ iaResult?.risk_type || 'No especificado' }}</p>
            <p><strong>Nivel detectado:</strong> {{ iaResult?.risk_level || 'No especificado' }}</p>
          </div>
          <div class="voice-actions">
            <button class="btn-cancel" (click)="resetVoice()">❌ Descartar</button>
            <button class="btn-confirm" (click)="goToEvidencesStep()">
              ➡️ Siguiente: Evidencias
            </button>
          </div>
        </div>
      </div>

      <!-- PASO DE EVIDENCIAS (COMÚN) -->
      <div
        *ngIf="
          (mode === 'manual' && manualStep === 'evidences') ||
          (mode === 'voice' && voiceStep === 'evidences')
        "
        class="form-card fade-in"
      >
        <h3>📎 Adjuntar Evidencias</h3>
        <p class="helper-text">
          Agrega fotos, videos, audios o documentos. El audio de la IA se adjunta automáticamente
          por separado.
        </p>

        <div class="evidence-buttons">
          <button class="ev-btn photo" (click)="triggerFileInput('PHOTO')">📷 Fotografía</button>
          <button class="ev-btn video" (click)="triggerFileInput('VIDEO')">🎥 Video</button>
          <button class="ev-btn audio" (click)="triggerFileInput('AUDIO')">🎵 Audio</button>
          <button class="ev-btn doc" (click)="triggerFileInput('DOCUMENT')">📄 Documento</button>
        </div>

        <input
          type="file"
          #fileInput
          hidden
          [accept]="currentAcceptType"
          (change)="onFileSelected($event)"
        />

        <div class="evidence-list" *ngIf="currentEvidences.length > 0">
          <h4>Evidencias agregadas ({{ currentEvidences.length }})</h4>
          <div *ngFor="let ev of currentEvidences; let i = index" class="evidence-item">
            <span class="ev-icon">{{ getEvidenceIcon(ev.evidence_type_id) }}</span>
            <div class="ev-details">
              <span class="ev-name">{{ ev.file_name }}</span>
              <span class="ev-size">{{ (ev.file_size / 1024).toFixed(1) }} KB</span>
            </div>
            <button class="btn-delete-ev" (click)="removeEvidence(i)" title="Eliminar">🗑️</button>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" (click)="goBackToDataStep()">⬅️ Volver</button>
          <button class="btn-submit" (click)="finalizeAndSave()" [disabled]="isSubmitting">
            {{ isSubmitting ? 'Guardando...' : '✅ Finalizar y Guardar Reporte' }}
          </button>
        </div>
      </div>

      <div
        *ngIf="errorMessage"
        class="message-box"
        [class.error]="errorMessage.includes('Error') || errorMessage.includes('❌')"
        [class.success]="errorMessage.includes('✅')"
      >
        {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [
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
      }
      .btn-back:hover {
        background: #f8fafc;
        color: #2563eb;
        transform: translateX(-3px);
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
        text-align: center;
        transition: all 0.3s;
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
      .btn-secondary {
        width: 100%;
        padding: 1rem;
        background: #f1f5f9;
        color: #475569;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 1rem;
      }
      .helper-text {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 1.5rem;
      }
      .evidence-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .ev-btn {
        padding: 1rem;
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        background: #f8fafc;
        cursor: pointer;
        font-weight: 600;
        color: #475569;
        transition: all 0.2s;
        font-size: 15px;
      }
      .ev-btn:hover {
        border-color: #3b82f6;
        background: #eff6ff;
        color: #2563eb;
      }
      .evidence-list {
        margin-top: 1.5rem;
        border-top: 1px solid #e2e8f0;
        padding-top: 1rem;
      }
      .evidence-list h4 {
        font-size: 14px;
        color: #475569;
        margin-bottom: 0.75rem;
      }
      .evidence-item {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 8px;
      }
      .ev-icon {
        font-size: 20px;
      }
      .ev-details {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .ev-name {
        font-size: 14px;
        font-weight: 600;
        color: #334155;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ev-size {
        font-size: 12px;
        color: #94a3b8;
      }
      .btn-delete-ev {
        background: #fee2e2;
        color: #ef4444;
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 16px;
      }
      .btn-delete-ev:hover {
        background: #fecaca;
      }
      .form-actions {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
      }
      .form-actions button {
        flex: 1;
        margin-top: 0;
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
        animation: pulse-ring 1.5s infinite;
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
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        padding: 1.5rem;
        margin: 1rem 0;
        text-align: left;
        font-size: 14px;
        line-height: 1.6;
        color: #166534;
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
        .mode-cards,
        .evidence-buttons {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RiskFormComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>; // <-- AGREGAR ESTA LÍNEA

  isOnline = true;
  isSubmitting = false;
  errorMessage = '';
  backendResult: RiskResponse | null = null;

  mode: FormMode = 'selection';
  manualStep: ManualStep = 'data';
  voiceStep: VoiceStep = 'idle';

  transcript = '';
  capturedAudioBase64 = '';
  iaResult: RiskResponse | null = null; // <-- AGREGAR

  coordinates: { lat: number; lng: number } | null = null;
  address = '';

  formData = { risk_type: '', risk_level: '', title: '', description: '' };

  currentEvidences: RiskEvidence[] = [];
  currentAcceptType = '*/*';

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
    this.manualStep = 'data';
    this.voiceStep = 'idle';
    this.errorMessage = '';
    this.backendResult = null;
    this.currentEvidences = [];
  }

  goToEvidencesStep() {
    if (this.mode === 'manual') this.manualStep = 'evidences';
    else if (this.mode === 'voice') this.voiceStep = 'evidences';
  }

  goBackToDataStep() {
    if (this.mode === 'manual') this.manualStep = 'data';
    else if (this.mode === 'voice') this.voiceStep = 'result';
  }

  triggerFileInput(type: keyof typeof EVIDENCE_TYPE_CATALOG) {
    this.currentAcceptType = EVIDENCE_TYPE_CATALOG[type].accept;
    setTimeout(() => this.fileInput.nativeElement.click(), 0);
  }

  goBack() {
    this.navService.navigateTo('home');
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const coords = this.coordinates || { lat: 0, lng: 0 };

    try {
      const base64 = await this.fileToBase64(file);
      let evType = 'DOCUMENT';
      if (file.type.startsWith('image/')) evType = 'PHOTO';
      else if (file.type.startsWith('video/')) evType = 'VIDEO';
      else if (file.type.startsWith('audio/')) evType = 'AUDIO';

      const newEvidence: RiskEvidence = {
        id: crypto.randomUUID(),
        risk_report_id: 'pending',
        evidence_type_id: EVIDENCE_TYPE_CATALOG[evType as keyof typeof EVIDENCE_TYPE_CATALOG].id,
        file_name: file.name,
        file_url: base64,
        mime_type: file.type,
        file_size: file.size,
        captured_date: new Date().toISOString(),
        latitude: coords.lat,
        longitude: coords.lng,
      };

      this.currentEvidences.push(newEvidence);
      this.notificationService.success('✅ Evidencia agregada', file.name);
    } catch (error) {
      this.notificationService.error('❌ Error', 'No se pudo procesar el archivo.');
    }
    input.value = ''; // Limpiar para permitir seleccionar el mismo archivo de nuevo
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  removeEvidence(index: number) {
    this.currentEvidences.splice(index, 1);
  }

  getEvidenceIcon(evTypeId: string): string {
    const type = Object.values(EVIDENCE_TYPE_CATALOG).find((t) => t.id === evTypeId);
    return type ? type.icon : '📄';
  }

  // 🆕 REEMPLAZA submitVoiceReport y submitManualReport por este único método unificado:
  async finalizeAndSave() {
    this.isSubmitting = true;
    try {
      const isIA = this.mode === 'voice';
      let backendResponse = isIA ? this.iaResult : null;

      // Si es manual y hay internet, obtenemos la respuesta de la IA ahora
      if (!isIA && this.isOnline) {
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
        backendResponse = await firstValueFrom(this.http.post<any>(url, payload, { headers }));
      }

      await this.saveReportToStorage({
        isIA,
        transcript: this.transcript,
        audioBase64: this.capturedAudioBase64,
        backendResponse,
        status: this.isOnline ? 'synced' : 'pending',
        evidences: this.currentEvidences,
      });

      this.notificationService.success(
        '✅ Reporte Guardado',
        'El reporte y sus evidencias se guardaron exitosamente.',
      );
      this.navService.navigateTo('home');
    } catch (error) {
      console.error('❌ Error finalizando reporte:', error);
      await this.saveReportToStorage({
        isIA: this.mode === 'voice',
        transcript: this.transcript,
        audioBase64: this.capturedAudioBase64,
        backendResponse: null,
        status: this.mode === 'voice' ? 'retry_ia' : 'error',
        evidences: this.currentEvidences,
      });
      this.notificationService.error(
        '❌ Error de Red',
        'Se guardó localmente para intentar más tarde.',
      );
      this.navService.navigateTo('home');
    } finally {
      this.isSubmitting = false;
    }
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
        this.voiceStep = 'idle';
      };
      this.recognition.onend = () => {
        if (this.voiceStep === 'listening') this.voiceStep = 'idle';
      };
    } else {
      this.errorMessage = 'Tu navegador no soporta la API de voz.';
    }
  }

  async startVoiceRecognition() {
    this.errorMessage = '';
    this.transcript = '';
    this.capturedAudioBase64 = '';
    this.voiceStep = 'listening';

    try {
      // 1. Iniciar grabación de audio real (para IndexedDB)
      await this.audioService.startRecording();
      // 2. Iniciar reconocimiento de texto (para la UI)
      if (this.recognition) this.recognition.start();
    } catch (e) {
      this.errorMessage = 'No se pudo acceder al micrófono.';
      this.voiceStep = 'idle';
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

      this.voiceStep = 'processing';

      setTimeout(() => {
        this.voiceStep = 'result';
      }, 1500);
    } catch (e) {
      console.error('❌ [IA] Error al procesar el audio:', e);
      this.errorMessage = 'Error al procesar el audio.';
      this.voiceStep = 'idle';
    }
  }

  resetVoice() {
    this.voiceStep = 'idle';
    this.transcript = '';
    this.capturedAudioBase64 = '';
    this.errorMessage = '';
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

  // --- MÉTODO UNIFICADO DE GUARDADO ---
  private async saveReportToStorage(data: {
    isIA: boolean;
    transcript: string;
    audioBase64?: string;
    backendResponse: any;
    status: 'synced' | 'pending' | 'error' | 'retry_ia';
    evidences: RiskEvidence[];
  }) {
    const rawRiskType = data.backendResponse?.risk_type || this.formData.risk_type;
    const rawRiskLevel = data.backendResponse?.risk_level || this.formData.risk_level;

    const riskTypeKey = this.getRiskTypeKey(rawRiskType);
    const riskLevelKey = this.getRiskLevelKey(rawRiskLevel);
    const coords = this.coordinates || { lat: 0, lng: 0 };

    const newReport: RiskReport = {
      id: crypto.randomUUID(),
      risk_type_id: RISK_TYPE_CATALOG[this.getRiskTypeKey(rawRiskType)].id,
      risk_status_id: RISK_STATUS_CATALOG.REPORTED.id,
      risk_level_id: RISK_LEVEL_CATALOG[this.getRiskLevelKey(rawRiskLevel)].id,
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
      direccion: this.address || 'Dirección no disponible',
      user_name: 'Técnico Demo',
      report_date: new Date().toISOString(),
      evidences: data.evidences,
      audio_url: data.isIA ? data.audioBase64 : undefined,
      created_at: new Date().toISOString(),
      sync_status: data.status,
      backend_response: data.backendResponse,
      ia_process: data.isIA
        ? {
            original_audio: data.audioBase64,
            transcript: data.transcript,
            ia_response: data.backendResponse,
            retry_count: data.status === 'retry_ia' ? 1 : 0,
          }
        : undefined,
    };

    await this.storageService.saveReport(newReport);
  }

  // --- UTILIDADES ---
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
