import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  speak(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Detener cualquier audio anterior
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CO';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Tu navegador no soporta audio.');
    }
  }
}
