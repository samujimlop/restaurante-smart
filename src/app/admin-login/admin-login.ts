import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, PATRON_USUARIO } from '../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.html',
})
export class AdminLogin {
  private auth = inject(AuthService);
  private router = inject(Router);

  userInput = '';
  pinInput = '';
  errorMsg = '';
  cargando = false;

  async acceder() {
    this.errorMsg = '';
    const usuario = this.userInput.trim().toLowerCase();

    if (!usuario || !this.pinInput) {
      this.errorMsg = 'Escribe tu usuario y PIN';
      return;
    }
    if (!PATRON_USUARIO.test(usuario)) {
      this.errorMsg = 'Usuario o PIN incorrectos';
      return;
    }

    this.cargando = true;
    try {
      await this.auth.login(usuario, this.pinInput);
      this.router.navigate(['/admin']);
    } catch (error: unknown) {
      const codigo = (error as { code?: string })?.code;
      if (codigo === 'auth/too-many-requests') {
        this.errorMsg = 'Demasiados intentos. Espera unos minutos.';
      } else if (codigo === 'auth/network-request-failed') {
        this.errorMsg = 'Sin conexión con el servidor';
      } else {
        // Mismo mensaje para usuario inexistente y PIN erróneo: no revela qué usuarios existen
        this.errorMsg = 'Usuario o PIN incorrectos';
      }
    } finally {
      this.pinInput = '';
      this.cargando = false;
    }
  }
}
