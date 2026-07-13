import { Injectable } from '@angular/core';
import localforage from 'localforage';
import { RiskReport } from '../components/interfaces/risk.models';

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor() {
    localforage.config({ name: 'RiskAppDB', storeName: 'reports' });
  }

  async saveReport(report: RiskReport): Promise<void> {
    await localforage.setItem(report.id, report);
  }

  async getAllReports(): Promise<RiskReport[]> {
    const reports: RiskReport[] = [];
    await localforage.iterate((value: RiskReport) => {
      reports.push(value);
    });
    return reports.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  async getPendingReports(): Promise<RiskReport[]> {
    const all = await this.getAllReports();
    return all.filter(
      (r) =>
        r.sync_status === 'pending' || r.sync_status === 'error' || r.sync_status === 'retry_ia',
    );
  }

  async updateReportStatus(
    id: string,
    status: 'synced' | 'error',
    backendResponse?: any,
  ): Promise<void> {
    const report = await localforage.getItem<RiskReport>(id);
    if (report) {
      report.sync_status = status;
      if (backendResponse) report.backend_response = backendResponse;
      await localforage.setItem(id, report);
    }
  }

  async deleteReport(id: string): Promise<void> {
    await localforage.removeItem(id);
  }
}
