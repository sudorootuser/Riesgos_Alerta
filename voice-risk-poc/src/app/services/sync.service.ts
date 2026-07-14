import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { RISK_LEVEL_CATALOG, RISK_TYPE_CATALOG, RiskReport } from '../components/interfaces/risk.models';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private isSyncing = false;

  constructor(
    private storageService: StorageService,
    private http: HttpClient,
  ) {
    window.addEventListener('online', () => this.triggerAutoSync());
  }

  async triggerAutoSync() {
    if (this.isSyncing) return;

    const pending = await this.storageService.getPendingReports();
    if (pending.length === 0) return;

    this.isSyncing = true;

    for (const report of pending) {
      try {
        await this.sendReportToBackend(report);
      } catch (error) {
        console.error(`Error sincronizando reporte ${report.id}:`, error);
        report.sync_status = 'error';
        await this.storageService.saveReport(report);
      }
    }

    this.isSyncing = false;
  }

  async syncSingleReport(report: RiskReport): Promise<void> {
    try {
      await this.sendReportToBackend(report);
    } catch (error) {
      console.error(`Error sincronizando reporte ${report.id}:`, error);
      report.sync_status = 'error';
      await this.storageService.saveReport(report);
      throw error;
    }
  }

  private async sendReportToBackend(report: RiskReport) {
    const url =
      'https://min-ai-dev-dev-n8n-main.happypebble-84155d3f.eastus2.azurecontainerapps.io/webhook/risk-ai';
    const headers = new HttpHeaders({
      Authentication: 'Bearer apsd8jfa8p98rj3p239jklds',
      'Content-Type': 'application/json',
    });

    // 🆕 Helpers para obtener el nombre (string) a partir del ID guardado en la BD
    // Esto es necesario porque el webhook espera el nombre, no el UUID
    const getTypeName = (id: string) =>
      Object.values(RISK_TYPE_CATALOG).find((t) => t.id === id)?.name || 'Desconocido';

    const getLevelName = (id: string) =>
      Object.values(RISK_LEVEL_CATALOG).find((l) => l.id === id)?.name || 'Medio';

    const payload = {
      message: { text: report.description, type: 'text' },
      risk_type: getTypeName(report.risk_type_id),
      risk_level: getLevelName(report.risk_level_id),
    };

    const response = await firstValueFrom(this.http.post<any>(url, payload, { headers }));

    report.backend_response = response;
    report.sync_status = 'synced';
    report.title = response.title || report.title;


    await this.storageService.saveReport(report);
  }
}
