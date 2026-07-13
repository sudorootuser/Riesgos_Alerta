import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '../../services/navigation.service';
import { NotificationService } from '../../services/notification.service';
import { StorageService } from '../../services/storage.service';
import { SyncService } from '../../services/sync.service';
import { RiskReport, RISK_TYPE_CATALOG, RISK_LEVEL_CATALOG } from '../interfaces/risk.models';

@Component({
  selector: 'app-home-navigation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="home-container">
      <h1>🛡️ Sistema de Gestión de Riesgos</h1>
      <p class="subtitle">Selecciona una opción para comenzar</p>

      <div class="cards-grid">
        <button class="nav-card map-card" (click)="goToMap()">
          <div class="icon">🗺️</div>
          <h2>Mapa de Riesgos</h2>
          <p>Visualiza tu ubicación y los riesgos reportados. Captura puntos o dibuja áreas.</p>
        </button>

        <button class="nav-card form-card" (click)="goToForm()">
          <div class="icon">📝</div>
          <h2>Crear Reporte</h2>
          <p>Diligencia el formulario manualmente o usa el asistente de voz.</p>
        </button>
      </div>

      <!-- Tabla de Reportes Pendientes -->
      <div class="pending-section" *ngIf="pendingReports.length > 0">
        <div class="pending-header">
          <h3>📋 Reportes Pendientes de Sincronización ({{ pendingReports.length }})</h3>
          <button class="btn-sync-all" (click)="syncAll()" [disabled]="isSyncing">
            {{ isSyncing ? '🔄 Sincronizando...' : '🔄 Sincronizar Todos' }}
          </button>
        </div>

        <div class="table-container">
          <table class="pending-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Nivel</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let report of pendingReports"
                [class.row-error]="
                  report.sync_status === 'error' || report.sync_status === 'retry_ia'
                "
              >
                <td>{{ report.created_at | date: 'short' }}</td>
                <td class="text-content">{{ report.title }}</td>
                <td>
                  <!-- ✅ CORREGIDO: Usar método auxiliar para obtener el nombre del tipo -->
                  <span class="badge">{{ getRiskTypeName(report.risk_type_id) }}</span>
                </td>
                <td>
                  <!-- ✅ CORREGIDO: Usar métodos auxiliares para nombre y clase CSS del nivel -->
                  <span class="badge level-{{ getRiskLevelClass(report.risk_level_id) }}">
                    {{ getRiskLevelName(report.risk_level_id) }}
                  </span>
                </td>
                <td>
                  <span
                    class="status-badge"
                    [ngClass]="{
                      'status-pending': report.sync_status === 'pending',
                      'status-error': report.sync_status === 'error',
                      'status-retry': report.sync_status === 'retry_ia',
                    }"
                  >
                    {{
                      report.sync_status === 'pending'
                        ? '⏳ Pendiente'
                        : report.sync_status === 'retry_ia'
                          ? '🔄 Reintento IA'
                          : '❌ Error'
                    }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button
                    class="btn-action btn-send"
                    (click)="syncSingle(report)"
                    [disabled]="isSyncing"
                    title="Sincronizar este reporte"
                  >
                    📤
                  </button>
                  <button
                    class="btn-action btn-delete"
                    (click)="deleteReport(report.id)"
                    title="Eliminar reporte"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mensaje cuando no hay pendientes -->
      <div class="no-pending" *ngIf="pendingReports.length === 0 && loaded">
        <div class="success-message">✅ Todos los reportes están sincronizados</div>
      </div>
    </div>
  `,
  styles: [
    `
      .home-container {
        text-align: center;
        padding: 2rem;
        max-width: 1100px;
        margin: 0 auto;
      }
      h1 {
        color: #1e293b;
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
      }
      .subtitle {
        color: #64748b;
        margin-bottom: 3rem;
        font-size: 1.1rem;
      }
      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin-bottom: 3rem;
      }
      .nav-card {
        border: none;
        border-radius: 16px;
        padding: 2.5rem;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: left;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      }
      .nav-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
      }
      .map-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .form-card {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
      }
      .icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.8rem;
      }
      p {
        margin: 0;
        opacity: 0.95;
        line-height: 1.6;
      }

      .pending-section {
        background: white;
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        text-align: left;
      }
      .pending-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .pending-header h3 {
        margin: 0;
        color: #1e293b;
        font-size: 1.3rem;
      }
      .btn-sync-all {
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-sync-all:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      .btn-sync-all:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .table-container {
        overflow-x: auto;
      }
      .pending-table {
        width: 100%;
        border-collapse: collapse;
        background: white;
      }
      .pending-table th,
      .pending-table td {
        padding: 1rem;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }
      .pending-table th {
        background: #f8fafc;
        font-weight: 600;
        color: #475569;
        font-size: 14px;
      }
      .pending-table .text-content {
        max-width: 250px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pending-table tr.row-error {
        background: #fef2f2;
      }
      .pending-table tr:hover {
        background: #f8fafc;
      }

      .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
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

      .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }
      .status-pending {
        background: #fff3cd;
        color: #856404;
      }
      .status-error {
        background: #f8d7da;
        color: #721c24;
      }
      .status-retry {
        background: #e0e7ff;
        color: #3730a3;
      }

      .actions-cell {
        white-space: nowrap;
      }
      .btn-action {
        border: none;
        background: none;
        cursor: pointer;
        font-size: 1.3rem;
        padding: 6px 10px;
        border-radius: 6px;
        transition: all 0.2s;
      }
      .btn-action:hover:not(:disabled) {
        background: #e2e8f0;
        transform: scale(1.1);
      }
      .btn-action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-send {
        color: #10b981;
      }
      .btn-delete {
        color: #ef4444;
      }

      .no-pending {
        margin-top: 2rem;
      }
      .success-message {
        background: #f0fdf4;
        color: #166534;
        padding: 1.5rem;
        border-radius: 12px;
        border: 1px solid #bbf7d0;
        font-weight: 600;
        font-size: 1.1rem;
      }

      @media (max-width: 768px) {
        .pending-table th:nth-child(3),
        .pending-table td:nth-child(3) {
          display: none;
        }
      }
    `,
  ],
})
export class HomeNavigationComponent implements OnInit {
  pendingReports: RiskReport[] = [];
  isSyncing = false;
  loaded = false;

  constructor(
    private navService: NavigationService,
    private storageService: StorageService,
    private syncService: SyncService,
    private notificationService: NotificationService,
  ) {}

  async ngOnInit() {
    await this.loadPendingReports();
  }

  async loadPendingReports() {
    this.pendingReports = await this.storageService.getPendingReports();
    this.loaded = true;
  }

  goToMap() {
    this.navService.navigateTo('map');
  }

  goToForm() {
    this.navService.navigateTo('form');
  }

  // ✅ MÉTODOS AUXILIARES PARA TRADUCIR IDs A NOMBRES LEGIBLES
  getRiskTypeName(id: string): string {
    const type = Object.values(RISK_TYPE_CATALOG).find((t) => t.id === id);
    return type ? type.name : 'Desconocido';
  }

  getRiskLevelName(id: string): string {
    const level = Object.values(RISK_LEVEL_CATALOG).find((l) => l.id === id);
    return level ? level.name : 'Desconocido';
  }

  getRiskLevelClass(id: string): string {
    const level = Object.values(RISK_LEVEL_CATALOG).find((l) => l.id === id);
    return level ? level.name.toLowerCase() : 'desconocido';
  }

  async syncAll() {
    if (this.pendingReports.length === 0) {
      this.notificationService.info('No hay reportes pendientes');
      return;
    }

    const confirmed = await this.notificationService.confirm(
      'Sincronizar Todos',
      `¿Deseas sincronizar ${this.pendingReports.length} reporte(s) pendiente(s)?`,
    );

    if (!confirmed) return;

    this.isSyncing = true;
    this.notificationService.loading('Sincronizando...', 'Enviando reportes al servidor');

    try {
      await this.syncService.triggerAutoSync();
      this.notificationService.success(
        '✅ Sincronización Completada',
        'Todos los reportes fueron enviados exitosamente',
      );
      await this.loadPendingReports();
    } catch (error) {
      this.notificationService.error(
        'Error de Sincronización',
        'Algunos reportes no pudieron enviarse',
      );
      await this.loadPendingReports();
    } finally {
      this.isSyncing = false;
      this.notificationService.close();
    }
  }

  async syncSingle(report: RiskReport) {
    const confirmed = await this.notificationService.confirm(
      'Sincronizar Reporte',
      `¿Deseas sincronizar el reporte "${report.title}"?`,
    );

    if (!confirmed) return;

    this.isSyncing = true;
    this.notificationService.loading('Sincronizando...', 'Enviando reporte al servidor');

    try {
      await this.syncService.syncSingleReport(report);
      this.notificationService.success(
        '✅ Reporte Sincronizado',
        'El reporte fue enviado exitosamente',
      );
      await this.loadPendingReports();
    } catch (error) {
      this.notificationService.error('Error de Sincronización', 'El reporte no pudo enviarse');
      await this.loadPendingReports();
    } finally {
      this.isSyncing = false;
      this.notificationService.close();
    }
  }

  async deleteReport(id: string) {
    const confirmed = await this.notificationService.confirm(
      'Eliminar Reporte',
      '¿Estás seguro de eliminar este reporte? Esta acción no se puede deshacer.',
    );

    if (!confirmed) return;

    await this.storageService.deleteReport(id);
    this.notificationService.success('Reporte Eliminado', 'El reporte fue eliminado correctamente');
    await this.loadPendingReports();
  }
}
