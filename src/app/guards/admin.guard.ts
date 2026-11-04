import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Solo gerencia. Es una protección de interfaz: la autorización real la aplican
 * las reglas de Firestore, así que saltarse este guard no da acceso a los datos.
 */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const perfil = await auth.esperarSesion();
  if (!perfil) return router.createUrlTree(['/login']);
  return auth.esGerente() ? true : router.createUrlTree(['/admin']);
};
