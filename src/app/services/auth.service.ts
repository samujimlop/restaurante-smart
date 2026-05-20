import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {

  getRole(): string {
    const sesion = localStorage.getItem('usuarioLogueado');
    if (sesion) {
      try {
        const usuario = JSON.parse(sesion);
        // Chivato para saber qué demonios estamos leyendo de tu Firebase
        console.log("🔥 DEBUG - Rol guardado en Firebase:", usuario.rol); 
        
        // Lo pasamos a minúsculas por si acaso lo tienes escrito como 'Admin' o 'ADMIN'
        return usuario.rol ? String(usuario.rol).toLowerCase() : 'staff';
      } catch (e) {
        return 'staff';
      }
    }
    return 'staff';
  }

  isAdmin(): boolean {
    const rol = this.getRole();
    // Aceptamos 'admin' o 'administrador' por si lo escribiste diferente en Firebase
    return rol === 'admin' || rol === 'administrador';
  }
}