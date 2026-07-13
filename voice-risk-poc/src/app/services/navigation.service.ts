import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Coordinates } from '../components/interfaces/risk.models';

export type AppView = 'home' | 'map' | 'form';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private currentViewSubject = new BehaviorSubject<AppView>('home');
  private prefillDataSubject = new BehaviorSubject<{ coords?: Coordinates } | null>(null);

  currentView$ = this.currentViewSubject.asObservable();
  prefillData$ = this.prefillDataSubject.asObservable();

  navigateTo(view: AppView, data?: { coords?: Coordinates }) {
    this.currentViewSubject.next(view);
    if (data) {
      this.prefillDataSubject.next(data);
    }
  }

  clearPrefillData() {
    this.prefillDataSubject.next(null);
  }
}
