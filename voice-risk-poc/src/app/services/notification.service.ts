import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  success(title: string, text?: string) {
    Swal.fire({
      icon: 'success',
      title: title,
      text: text,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  }

  error(title: string, text?: string) {
    Swal.fire({
      icon: 'error',
      title: title,
      text: text,
    });
  }

  info(title: string, text?: string) {
    Swal.fire({
      icon: 'info',
      title: title,
      text: text,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  }

  warning(title: string, text?: string) {
    Swal.fire({
      icon: 'warning',
      title: title,
      text: text,
    });
  }

  async confirm(title: string, text: string): Promise<boolean> {
    const result = await Swal.fire({
      title: title,
      text: text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
    });
    return result.isConfirmed;
  }

  loading(title: string, text?: string) {
    Swal.fire({
      title: title,
      text: text,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  close() {
    Swal.close();
  }
}
