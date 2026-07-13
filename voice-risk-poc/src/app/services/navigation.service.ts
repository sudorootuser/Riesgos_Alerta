import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CoordinatePoint, Coordinates } from '../components/interfaces/risk.models';

export type AppView = 'home' | 'map' | 'form';

export interface NavigationData {
  coords?: Coordinates;
  polygon?: CoordinatePoint[];
  coordinateType?: 'POINT' | 'POLYGON';
}

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private currentViewSubject = new BehaviorSubject<AppView>('home');
  private prefillDataSubject = new BehaviorSubject<NavigationData | null>(null);

  currentView$ = this.currentViewSubject.asObservable();
  prefillData$ = this.prefillDataSubject.asObservable();

  // 🆕 El tipo de 'data' ahora usa la nueva interfaz
  navigateTo(view: AppView, data?: NavigationData) {
    this.currentViewSubject.next(view);
    if (data) {
      this.prefillDataSubject.next(data);
    }
  }

  clearPrefillData() {
    this.prefillDataSubject.next(null);
  }
}
