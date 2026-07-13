import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService, AppView } from './services/navigation.service';
import { SyncService } from './services/sync.service'; // <-- Importar
import { HomeNavigationComponent } from './components/home-navigation/home-navigation.component';
import { RiskFormComponent } from './components/form/risk-form/risk-form.component';
import { RiskMapComponent } from './components/map/risk-map/risk-map.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HomeNavigationComponent, RiskMapComponent, RiskFormComponent],
  template: `
    <app-home-navigation *ngIf="currentView === 'home'"></app-home-navigation>
    <app-risk-map *ngIf="currentView === 'map'"></app-risk-map>
    <app-risk-form *ngIf="currentView === 'form'"></app-risk-form>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }
    `,
  ],
})
export class AppComponent {
  currentView: AppView = 'home';

  constructor(
    private navService: NavigationService,
    private syncService: SyncService, // <-- Inyectar para activar el listener
  ) {
    this.navService.currentView$.subscribe((view) => {
      this.currentView = view;
    });
  }
}
