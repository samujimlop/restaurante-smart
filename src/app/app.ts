import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast/toast'; // <-- 1. IMPORTA EL TOAST AQUÍ

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent], // <-- 2. AÑÁDELO AL ARRAY DE IMPORTS
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('restaurante-smart');
}