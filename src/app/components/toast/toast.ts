import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (toastService.toast) {
      <div class="fixed top-5 right-5 z-[9999] p-4 rounded-2xl shadow-xl border flex items-center gap-3 transition-all duration-300"
           [class.bg-emerald-900]="toastService.toast.type === 'success'"
           [class.border-emerald-500]="toastService.toast.type === 'success'"
           [class.bg-red-900]="toastService.toast.type === 'error'"
           [class.border-red-500]="toastService.toast.type === 'error'"
           [class.bg-blue-900]="toastService.toast.type === 'info'"
           [class.border-blue-500]="toastService.toast.type === 'info'">
        <span class="font-bold text-white text-sm">{{ toastService.toast.message }}</span>
      </div>
    }
  `
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}
}