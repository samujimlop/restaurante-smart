import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Cualquier empleado con sesión iniciada (camarero, cocina o gerencia). */
export const staffGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return (await auth.esperarSesion()) ? true : router.createUrlTree(['/login']);
};
