import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { GeolocationService } from '../../../services/geolocation.service';
import { StorageService } from '../../../services/storage.service';
import { TtsService } from '../../../services/tts.service';
import {
  Coordinates,
  CoordinatePoint,
  DrawingState,
  RiskReport,
  RISK_LEVEL_CATALOG,
  EVIDENCE_TYPE_CATALOG,
  RISK_TYPE_CATALOG,
  RiskEvidence,
} from '../../interfaces/risk.models';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-risk-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-wrapper">
      <div class="map-header">
        <button class="btn-back-modern" (click)="goBack()">
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
          Volver al Inicio
        </button>
        <h2>🗺️ Mapa de Riesgos</h2>
      </div>

      <div id="map" class="map-container"></div>

      <!-- Controles de Dibujo Flotantes -->
      <div class="drawing-controls" *ngIf="!isDrawing">
        <button class="float-btn point-btn" (click)="startDrawing('point')">
          📍 Capturar Punto
        </button>
        <button class="float-btn polygon-btn" (click)="startDrawing('polygon')">
          ⬠ Dibujar Polígono
        </button>
      </div>

      <!-- Controles durante el dibujo -->
      <div class="drawing-active-controls" *ngIf="isDrawing">
        <p *ngIf="drawingState.mode === 'polygon'">
          Toca el mapa para añadir vértices ({{ drawingState.tempPoints.length }})
        </p>
        <button
          class="btn-finish"
          *ngIf="drawingState.mode === 'polygon' && drawingState.tempPoints.length >= 3"
          (click)="finishPolygon()"
        >
          ✅ Finalizar Polígono
        </button>
        <button class="btn-cancel" (click)="cancelDrawing()">❌ Cancelar</button>
      </div>

      <!-- Botón para ir al formulario -->
      <div class="create-report-fab" *ngIf="capturedLocation">
        <button class="btn-primary-large" (click)="goToFormWithLocation()">
          + Crear Reporte en esta ubicación
        </button>
      </div>

      <!-- Modal de Detalles del Reporte -->
      <div class="modal-overlay" *ngIf="selectedReport" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-section">
              <h3 class="modal-title">{{ selectedReport.title }}</h3>
              <span
                class="modal-badge"
                [style.background-color]="getRiskColor(selectedReport.risk_level_id)"
              >
                {{ getRiskLevelName(selectedReport.risk_level_id) }}
              </span>
            </div>
            <button class="modal-close" (click)="closeModal()">✕</button>
          </div>

          <div class="modal-body">
            <!-- Información General -->
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">📋 Tipo de Riesgo:</span>
                <span class="info-value">{{ getRiskTypeName(selectedReport.risk_type_id) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">📍 Dirección:</span>
                <span class="info-value">{{ selectedReport.direccion }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">👤 Usuario:</span>
                <span class="info-value">{{ selectedReport.user_name }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">📅 Fecha:</span>
                <span class="info-value">{{ selectedReport.report_date | date: 'medium' }}</span>
              </div>
            </div>

            <!-- Descripción -->
            <div class="description-section">
              <h4>📝 Descripción</h4>
              <p class="description-text">{{ selectedReport.description }}</p>
            </div>

            <!-- Audio Principal (si existe) -->
            <div class="audio-section" *ngIf="selectedReport.audio_url">
              <h4>🎙️ Audio del Reporte</h4>
              <audio controls class="modal-audio">
                <source [src]="selectedReport.audio_url" type="audio/webm" />
                Tu navegador no soporta audio.
              </audio>
            </div>

            <!-- Evidencias -->
            <div
              class="evidences-section"
              *ngIf="selectedReport.evidences && selectedReport.evidences.length > 0"
            >
              <h4>📎 Evidencias Adjuntas ({{ selectedReport.evidences.length }})</h4>
              <div class="evidences-grid">
                <div
                  *ngFor="let ev of selectedReport.evidences"
                  class="evidence-card"
                  (click)="openEvidence(ev)"
                >
                  <div class="evidence-icon">{{ getEvidenceIcon(ev.evidence_type_id) }}</div>
                  <div class="evidence-info">
                    <span class="evidence-name">{{ ev.file_name }}</span>
                    <span class="evidence-size">{{ (ev.file_size / 1024).toFixed(1) }} KB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-tts" (click)="speakReport()">🔊 Leer Resumen</button>
          </div>
        </div>
      </div>

      <!-- Modal de Visualización de Evidencia -->
      <div class="evidence-modal-overlay" *ngIf="selectedEvidence" (click)="closeEvidenceModal()">
        <div class="evidence-modal-content" (click)="$event.stopPropagation()">
          <button class="evidence-modal-close" (click)="closeEvidenceModal()">✕</button>

          <!-- Imagen -->
          <img
            *ngIf="selectedEvidence.mime_type.startsWith('image/')"
            [src]="selectedEvidence.file_url"
            class="evidence-full-image"
          />

          <!-- Video -->
          <video
            *ngIf="selectedEvidence.mime_type.startsWith('video/')"
            controls
            class="evidence-full-video"
          >
            <source [src]="selectedEvidence.file_url" [type]="selectedEvidence.mime_type" />
          </video>

          <!-- Audio -->
          <div
            *ngIf="selectedEvidence.mime_type.startsWith('audio/')"
            class="evidence-audio-container"
          >
            <h3>🎵 {{ selectedEvidence.file_name }}</h3>
            <audio controls class="evidence-full-audio">
              <source [src]="selectedEvidence.file_url" [type]="selectedEvidence.mime_type" />
            </audio>
          </div>

          <!-- Documento -->
          <div
            *ngIf="
              !selectedEvidence.mime_type.startsWith('image/') &&
              !selectedEvidence.mime_type.startsWith('video/') &&
              !selectedEvidence.mime_type.startsWith('audio/')
            "
            class="evidence-document"
          >
            <div class="document-icon">📄</div>
            <h3>{{ selectedEvidence.file_name }}</h3>
            <p>Tipo: {{ selectedEvidence.mime_type }}</p>
            <a
              [href]="selectedEvidence.file_url"
              [download]="selectedEvidence.file_name"
              class="btn-download"
            >
              ⬇️ Descargar
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .map-wrapper {
        position: relative;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .map-header {
        padding: 1rem 1.5rem;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .map-container {
        flex: 1;
        width: 100%;
        z-index: 1;
      }

      .btn-back-modern {
        background: white;
        border: 1px solid #e2e8f0;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        font-size: 14px;
      }
      .btn-back-modern:hover {
        background: #f8fafc;
        color: #2563eb;
        border-color: #2563eb;
        transform: translateX(-3px);
      }

      .drawing-controls {
        position: absolute;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        display: flex;
        gap: 1rem;
      }
      .float-btn {
        padding: 12px 20px;
        border: none;
        border-radius: 25px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
      }
      .float-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      }
      .point-btn {
        background: #2196f3;
        color: white;
      }
      .polygon-btn {
        background: #ff9800;
        color: white;
      }

      .drawing-active-controls {
        position: absolute;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        text-align: center;
      }
      .btn-finish {
        background: #10b981;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        margin-right: 8px;
        font-weight: 600;
      }
      .btn-cancel {
        background: #ef4444;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      }

      .create-report-fab {
        position: absolute;
        bottom: 2rem;
        right: 2rem;
        z-index: 1000;
      }
      .btn-primary-large {
        padding: 15px 25px;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 30px;
        font-weight: bold;
        font-size: 1.1rem;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        transition: transform 0.2s;
      }
      .btn-primary-large:hover {
        transform: scale(1.05);
      }

      /* Modal de Detalles */
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      .modal-content {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      }
      @keyframes slideUp {
        from {
          transform: translateY(30px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      .modal-header {
        padding: 1.5rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        position: sticky;
        top: 0;
        background: white;
        z-index: 10;
      }
      .modal-title-section {
        flex: 1;
      }
      .modal-title {
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        color: #1e293b;
      }
      .modal-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 700;
        color: white;
      }
      .modal-close {
        background: #f1f5f9;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        color: #64748b;
        transition: all 0.2s;
      }
      .modal-close:hover {
        background: #e2e8f0;
        color: #1e293b;
      }

      .modal-body {
        padding: 1.5rem;
      }
      .info-section {
        margin-bottom: 1.5rem;
      }
      .info-row {
        display: flex;
        padding: 0.75rem 0;
        border-bottom: 1px solid #f1f5f9;
      }
      .info-label {
        font-weight: 600;
        color: #64748b;
        min-width: 140px;
      }
      .info-value {
        color: #1e293b;
        flex: 1;
      }

      .description-section {
        margin-bottom: 1.5rem;
      }
      .description-section h4 {
        margin: 0 0 0.75rem 0;
        color: #475569;
        font-size: 1rem;
      }
      .description-text {
        color: #334155;
        line-height: 1.6;
        margin: 0;
      }

      .audio-section {
        margin-bottom: 1.5rem;
      }
      .audio-section h4 {
        margin: 0 0 0.75rem 0;
        color: #475569;
        font-size: 1rem;
      }
      .modal-audio {
        width: 100%;
        border-radius: 8px;
      }

      .evidences-section h4 {
        margin: 0 0 1rem 0;
        color: #475569;
        font-size: 1rem;
      }
      .evidences-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
      }
      .evidence-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1rem;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .evidence-card:hover {
        background: #eff6ff;
        border-color: #3b82f6;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
      }
      .evidence-icon {
        font-size: 2rem;
      }
      .evidence-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .evidence-name {
        font-weight: 600;
        color: #1e293b;
        font-size: 0.9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .evidence-size {
        font-size: 0.75rem;
        color: #64748b;
      }

      .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        position: sticky;
        bottom: 0;
        background: white;
      }
      .btn-tts {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-tts:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }

      /* Modal de Evidencia */
      .evidence-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
        animation: fadeIn 0.2s ease;
      }
      .evidence-modal-content {
        position: relative;
        max-width: 90%;
        max-height: 90vh;
        background: white;
        border-radius: 12px;
        overflow: hidden;
      }
      .evidence-modal-close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        color: #1e293b;
        z-index: 10;
        transition: all 0.2s;
      }
      .evidence-modal-close:hover {
        background: white;
        transform: scale(1.1);
      }
      .evidence-full-image {
        max-width: 100%;
        max-height: 90vh;
        display: block;
      }
      .evidence-full-video {
        max-width: 100%;
        max-height: 90vh;
        display: block;
      }
      .evidence-audio-container {
        padding: 3rem;
        text-align: center;
      }
      .evidence-audio-container h3 {
        margin: 0 0 1.5rem 0;
        color: #1e293b;
      }
      .evidence-full-audio {
        width: 100%;
        max-width: 500px;
      }
      .evidence-document {
        padding: 3rem;
        text-align: center;
      }
      .document-icon {
        font-size: 5rem;
        margin-bottom: 1rem;
      }
      .evidence-document h3 {
        margin: 0 0 0.5rem 0;
        color: #1e293b;
      }
      .evidence-document p {
        color: #64748b;
        margin: 0 0 1.5rem 0;
      }
      .btn-download {
        display: inline-block;
        background: #3b82f6;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.2s;
      }
      .btn-download:hover {
        background: #2563eb;
        transform: translateY(-2px);
      }
    `,
  ],
})
export class RiskMapComponent implements OnInit, AfterViewInit, OnDestroy {
  private map!: L.Map;
  reports: RiskReport[] = [];
  isDrawing = false;
  drawingState: DrawingState = { mode: null, tempPoints: [] };
  capturedLocation: Coordinates | null = null;
  selectedReport: RiskReport | null = null;
  selectedEvidence: RiskEvidence | null = null;
  private mapClickHandler!: L.LeafletEventHandlerFn;
  private mapLayers: L.Layer[] = [];

  constructor(
    private navService: NavigationService,
    private storageService: StorageService,
    private geoService: GeolocationService,
    private ttsService: TtsService,
  ) {}

  ngOnInit() {
    this.loadReports();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }

  private async loadReports() {
    this.reports = await this.storageService.getAllReports();
    if (this.map) this.renderMarkers();
  }

  private initMap() {
    this.map = L.map('map').setView([3.4516, -76.532], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.geoService.getCurrentPosition().then((pos) => {
      this.map.setView([pos.lat, pos.lng], 15);
      L.marker([pos.lat, pos.lng], {
        icon: L.divIcon({
          className: 'user-location-pin',
          html: '<div style="background:#2196F3;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>',
        }),
      })
        .addTo(this.map)
        .bindPopup('📍 Tu ubicación actual');
    });

    this.renderMarkers();
    this.mapClickHandler = ((e: any) => this.handleMapClick(e)) as any;
    this.map.on('click', this.mapClickHandler);
  }

  private renderMarkers() {
    // Limpiar capas anteriores
    this.mapLayers.forEach((layer) => this.map.removeLayer(layer));
    this.mapLayers = [];

    this.reports.forEach((report) => {
      const levelName = this.getRiskLevelName(report.risk_level_id);
      const color = this.getRiskColor(report.risk_level_id);

      // Verificar si es polígono o punto
      if (report.risk_type_coordinate_id === 'coord-002' && report.jsonCoordinate.length >= 3) {
        // Es un polígono - dibujar área rellena
        const latLngs = report.jsonCoordinate.map(
          (p) => [p.latitude, p.longitude] as L.LatLngTuple,
        );
        const polygon = L.polygon(latLngs, {
          color: color,
          fillColor: color,
          fillOpacity: 0.4,
          weight: 3,
        }).addTo(this.map);

        polygon.on('click', () => this.openModal(report));
        this.mapLayers.push(polygon);
      } else {
        // Es un punto - dibujar marcador
        const marker = L.circleMarker([report.latitude, report.longitude], {
          radius: 12,
          fillColor: color,
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(this.map);

        marker.on('click', () => this.openModal(report));
        this.mapLayers.push(marker);
      }
    });
  }

  openModal(report: RiskReport) {
    this.selectedReport = report;
  }

  closeModal() {
    this.selectedReport = null;
  }

  openEvidence(evidence: RiskEvidence) {
    this.selectedEvidence = evidence;
  }

  closeEvidenceModal() {
    this.selectedEvidence = null;
  }

  speakReport() {
    if (this.selectedReport) {
      const text = `${this.selectedReport.title}. ${this.selectedReport.description}`;
      this.ttsService.speak(text);
    }
  }

  protected getRiskLevelName(levelId: string): string {
    const level = Object.values(RISK_LEVEL_CATALOG).find((l) => l.id === levelId);
    return level ? level.name : 'Desconocido';
  }

  protected getRiskTypeName(typeId: string): string {
    const type = Object.values(RISK_TYPE_CATALOG).find((t) => t.id === typeId);
    return type ? type.name : 'Desconocido';
  }

  protected getRiskColor(levelId: string): string {
    const levelName = this.getRiskLevelName(levelId);
    if (levelName === 'Alto' || levelName === 'Crítico') return '#ef4444';
    if (levelName === 'Medio') return '#f59e0b';
    return '#10b981';
  }

  protected getEvidenceIcon(typeId: string): string {
    const type = Object.values(EVIDENCE_TYPE_CATALOG).find((t) => t.id === typeId);
    return type ? type.icon : '📄';
  }

  startDrawing(mode: 'point' | 'polygon') {
    this.isDrawing = true;
    this.drawingState = { mode, tempPoints: [] };
    this.capturedLocation = null;
  }

  private handleMapClick(e: L.LeafletMouseEvent) {
    if (!this.isDrawing) return;

    const point: CoordinatePoint = { latitude: e.latlng.lat, longitude: e.latlng.lng };
    this.drawingState.tempPoints.push(point);

    if (this.drawingState.mode === 'point') {
      this.capturedLocation = { lat: point.latitude, lng: point.longitude };
      this.cancelDrawing();
    } else {
      // Dibujar punto temporal para polígono
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius: 6,
        color: '#ff9800',
        fillColor: '#ff9800',
        fillOpacity: 1,
      }).addTo(this.map);
      this.mapLayers.push(marker);

      // Si hay más de un punto, dibujar línea
      if (this.drawingState.tempPoints.length > 1) {
        const prevPoint = this.drawingState.tempPoints[this.drawingState.tempPoints.length - 2];
        const line = L.polyline(
          [
            [prevPoint.latitude, prevPoint.longitude],
            [point.latitude, point.longitude],
          ],
          {
            color: '#ff9800',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10',
          },
        ).addTo(this.map);
        this.mapLayers.push(line);
      }
    }
  }

  finishPolygon() {
    if (this.drawingState.tempPoints.length >= 3) {
      // Guardar todos los puntos del polígono
      this.capturedLocation = {
        lat: this.drawingState.tempPoints[0].latitude,
        lng: this.drawingState.tempPoints[0].longitude,
      };

      // Navegar al formulario con todos los puntos
      this.navService.navigateTo('form', {
        coords: this.capturedLocation,
        polygon: this.drawingState.tempPoints,
        coordinateType: 'POLYGON',
      });

      this.cancelDrawing();
    }
  }

  goToFormWithLocation() {
    if (this.capturedLocation) {
      this.navService.navigateTo('form', {
        coords: this.capturedLocation,
        coordinateType: 'POINT',
      });
    }
  }

  cancelDrawing() {
    this.isDrawing = false;
    this.drawingState = { mode: null, tempPoints: [] };

    // Limpiar solo las capas temporales de dibujo
    this.mapLayers.forEach((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
        if (!(layer as any)._popup) {
          this.map.removeLayer(layer);
        }
      }
    });
    this.mapLayers = this.mapLayers.filter((layer) => (layer as any)._popup);
  }

  goBack() {
    this.navService.navigateTo('home');
  }
}
