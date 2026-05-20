import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  toast: { message: string, type: 'success' | 'error' | 'info' } | null = null;

  show(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.toast = { message, type };
    // Se cierra solo a los 3 segundos
    setTimeout(() => this.toast = null, 3000);
  }
}