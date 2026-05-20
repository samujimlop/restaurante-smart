import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router'; // <-- AÑADIDO RouterLink AQUÍ
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink], // <-- AÑADIDO RouterLink AQUÍ
  templateUrl: './admin-login.html'
})
export class AdminLogin {
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router);

  // Estas son las variables que usaremos en el HTML
  userInput: string = '';
  pinInput: string = '';
  errorMsg: string = '';

  async acceder() {
    this.errorMsg = '';

    if (!this.userInput || !this.pinInput) {
      this.errorMsg = 'Escribe tu usuario y PIN';
      return;
    }

    try {
      const q = query(collection(this.firestore, 'usuarios'), where('usuario', '==', this.userInput));
      const snap = await getDocs(q);

      if (snap.empty) {
        this.errorMsg = 'Este usuario no existe';
      } else {
        const user = snap.docs[0].data();
        if (user['pin'] === this.pinInput) {
          localStorage.setItem('usuarioLogueado', JSON.stringify({
            nombre: user['nombre'],
            rol: user['rol']
          }));
          this.router.navigate(['/admin']);
        } else {
          this.errorMsg = 'PIN incorrecto';
        }
      }
    } catch (e) {
      this.errorMsg = 'Error de conexión con la base de datos';
    }
  }
}