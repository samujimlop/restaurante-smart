import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, PermisosEmpleado } from '../services/auth.service';

/**
 * Empleados con un permiso concreto (gerencia los tiene todos). Como los otros
 * guards, solo protege la interfaz: firestore.rules aplica el mismo permiso.
 */
export const permisoGuard =
  (permiso: keyof PermisosEmpleado): CanActivateFn =>
  async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const perfil = await auth.esperarSesion();
    if (!perfil) return router.createUrlTree(['/login']);
    return auth.tienePermiso(permiso) ? true : router.createUrlTree(['/admin']);
  };
