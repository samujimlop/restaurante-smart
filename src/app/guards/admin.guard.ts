import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // 1. Verificación de estado de sesión
  const sesion = localStorage.getItem('usuarioLogueado');

  if (sesion) {
    try {
      const usuario = JSON.parse(sesion);
      const rol = usuario.rol ? String(usuario.rol).toLowerCase() : '';

      // 2. Validación de privilegios
      if (rol === 'admin' || rol === 'administrador' || rol === 'jefe' || rol === 'gerente') {
        return true; // Acceso autorizado
      }
    } catch (e) {
      console.error('Error procesando sesión en el Guard', e);
    }
  }

  // 3. Fallo de seguridad: Redirección inmediata
  router.navigate(['/admin']);
  return false;
};