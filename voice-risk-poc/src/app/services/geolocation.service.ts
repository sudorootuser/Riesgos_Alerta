import { Injectable } from '@angular/core';
import { Coordinates } from '../components/interfaces/risk.models';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  getCurrentPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject('Geolocalización no soportada');
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
      );
    });
  }

  async getAddressFromCoords(
    lat: number,
    lng: number,
  ): Promise<{ address: string; comuna: string; barrio: string }> {
    try {
      // Nominatim requiere un User-Agent único
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'User-Agent': 'RiskAppDemo/1.0 (tuemail@ejemplo.com)' },
        },
      );
      const data = await response.json();

      return {
        address: data.display_name || 'Dirección desconocida',
        comuna: data.address?.city_district || data.address?.suburb || 'N/A',
        barrio: data.address?.neighbourhood || data.address?.suburb || 'N/A',
      };
    } catch (error) {
      console.error('Error en geocodificación inversa:', error);
      return { address: 'Dirección no disponible', comuna: 'N/A', barrio: 'N/A' };
    }
  }
}
