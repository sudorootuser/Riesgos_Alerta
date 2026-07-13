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

      /* ESTILOS PARA LA TARJETA DEL POPUP */
      .risk-popup-card {
        font-family: 'Segoe UI', system-ui, sans-serif;
        min-width: 250px;
      }
      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 8px;
        margin-bottom: 8px;
      }
      .popup-title {
        font-size: 15px;
        font-weight: 700;
        color: #1e293b;
        margin: 0;
      }
      .popup-badge {
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        color: white;
      }
      .popup-body {
        margin-bottom: 8px;
      }
      .popup-summary {
        font-size: 13px;
        color: #475569;
        line-height: 1.4;
        margin: 0 0 8px 0;
      }
      .popup-address {
        font-size: 12px;
        color: #64748b;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Reproductor de audio nativo estilizado */
      .popup-audio {
        width: 100%;
        margin-top: 8px;
        border-radius: 6px;
      }

      .popup-footer {
        margin-top: 8px;
        text-align: right;
        border-top: 1px solid #f1f5f9;
        padding-top: 8px;
      }
      .popup-tts-btn {
        background: #f1f5f9;
        color: #475569;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: background 0.2s;
      }
      .popup-tts-btn:hover {
        background: #e2e8f0;
        color: #2563eb;
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
  private mapClickHandler!: L.LeafletEventHandlerFn;

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
    // Limpiar marcadores anteriores (excepto el de ubicación del usuario)
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        if (
          (layer as any)._popup &&
          (layer as any)._popup._content &&
          !(layer as any)._icon?.className?.includes('user-location-pin')
        ) {
          this.map.removeLayer(layer);
        }
      }
    });

    this.reports.forEach((report) => {
      const levelName = this.getRiskLevelName(report.risk_level_id);
      const color =
        levelName === 'Alto' || levelName === 'Crítico'
          ? '#ef4444'
          : levelName === 'Medio'
            ? '#f59e0b'
            : '#10b981';

      const marker = L.circleMarker([report.latitude, report.longitude], {
        radius: 10,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(this.map);

      // 🆕 LÓGICA CONDICIONAL PARA EL AUDIO
      const hasAudio = !!report.audio_url;
      const audioPlayerHtml = hasAudio
        ? `<audio controls class="popup-audio"><source src="${report.audio_url}" type="audio/webm">Tu navegador no soporta audio.</audio>`
        : '';

      const summaryText =
        report.backend_response?.report_summary ||
        report.description.substring(0, 100) + (report.description.length > 100 ? '...' : '');
      const safeSummary = summaryText.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeTitle = report.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');

      // 🆕 PLANTILLA HTML TIPO CARD
      const popupContent = `
        <div class="risk-popup-card">
          <div class="popup-header">
            <p class="popup-title">${report.title}</p>
            <span class="popup-badge" style="background-color: ${color};">${levelName}</span>
          </div>
          <div class="popup-body">
            <p class="popup-summary">${summaryText}</p>
            <p class="popup-address">📍 ${report.direccion}</p>
            ${audioPlayerHtml}
          </div>
          <div class="popup-footer">
            <button class="popup-tts-btn" onclick="window.speakText('${safeTitle}. ${safeSummary}')">
              🔊 Leer Resumen
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Hack para exponer la función de TTS al popup HTML
      (window as any).speakText = (text: string) => this.ttsService.speak(text);
    });
  }

  private getRiskLevelName(levelId: string): string {
    const level = Object.values(RISK_LEVEL_CATALOG).find((l) => l.id === levelId);
    return level ? level.name : 'Desconocido';
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
      L.circleMarker([point.latitude, point.longitude], { radius: 4, color: 'blue' }).addTo(
        this.map,
      );
    }
  }

  finishPolygon() {
    if (this.drawingState.tempPoints.length >= 3) {
      const firstPoint = this.drawingState.tempPoints[0];
      this.capturedLocation = { lat: firstPoint.latitude, lng: firstPoint.longitude };
      this.cancelDrawing();
    }
  }

  goToFormWithLocation() {
    if (this.capturedLocation) {
      this.navService.navigateTo('form', { coords: this.capturedLocation });
    }
  }

  cancelDrawing() {
    this.isDrawing = false;
    this.drawingState = { mode: null, tempPoints: [] };
    this.map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker && !(layer as any)._popup) {
        this.map.removeLayer(layer);
      }
    });
  }

  goBack() {
    this.navService.navigateTo('home');
  }
}
