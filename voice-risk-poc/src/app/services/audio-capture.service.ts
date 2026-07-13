import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start();
    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      throw new Error('No se pudo acceder al micrófono');
    }
  }

  async stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject('No hay grabación activa');

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const base64 = await this.blobToBase64(audioBlob);

        this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
        resolve(base64);
      };

      this.mediaRecorder.stop();
    });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
