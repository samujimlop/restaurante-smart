import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService, PerfilEmpleado } from '../services/auth.service';
import { adminGuard } from './admin.guard';
import { staffGuard } from './staff.guard';
import { permisoGuard } from './permiso.guard';

/** AuthService falso con el perfil indicado (null = sin sesión). */
function configurar(perfil: PerfilEmpleado | null, esGerente = false) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          esperarSesion: async () => perfil,
          esGerente: () => esGerente,
          tienePermiso: (p: keyof NonNullable<PerfilEmpleado['permisos']>) =>
            esGerente || perfil?.permisos?.[p] === true,
        },
      },
    ],
  });
}

const ejecutar = (guard: typeof adminGuard) =>
  TestBed.runInInjectionContext(() => guard(null as any, null as any)) as Promise<
    boolean | UrlTree
  >;

const ruta = (resultado: boolean | UrlTree) =>
  resultado instanceof UrlTree ? TestBed.inject(Router).serializeUrl(resultado) : resultado;

const camarero: PerfilEmpleado = { nombre: 'Paula', usuario: 'paula', rol: 'Camarero' };
const gerente: PerfilEmpleado = { nombre: 'Samuel', usuario: 'samuel', rol: 'Gerente' };

describe('staffGuard', () => {
  it('manda al login si no hay sesión', async () => {
    configurar(null);
    expect(ruta(await ejecutar(staffGuard))).toBe('/login');
  });

  it('deja pasar a cualquier empleado con sesión', async () => {
    configurar(camarero);
    expect(await ejecutar(staffGuard)).toBe(true);
  });
});

describe('adminGuard', () => {
  it('manda al login si no hay sesión', async () => {
    configurar(null);
    expect(ruta(await ejecutar(adminGuard))).toBe('/login');
  });

  it('devuelve al panel a un empleado que no es gerente', async () => {
    configurar(camarero, false);
    expect(ruta(await ejecutar(adminGuard))).toBe('/admin');
  });

  it('deja pasar a gerencia', async () => {
    configurar(gerente, true);
    expect(await ejecutar(adminGuard)).toBe(true);
  });
});

describe('permisoGuard', () => {
  const conInventario: PerfilEmpleado = {
    ...camarero,
    permisos: { verInventario: true, verVentas: false, cobrarMesas: false },
  };

  it('manda al login si no hay sesión', async () => {
    configurar(null);
    expect(ruta(await ejecutar(permisoGuard('verInventario')))).toBe('/login');
  });

  it('devuelve al panel a un empleado sin el permiso', async () => {
    configurar(conInventario);
    expect(ruta(await ejecutar(permisoGuard('verVentas')))).toBe('/admin');
  });

  it('deja pasar a un empleado con el permiso', async () => {
    configurar(conInventario);
    expect(await ejecutar(permisoGuard('verInventario'))).toBe(true);
  });

  it('deja pasar siempre a gerencia', async () => {
    configurar(gerente, true);
    expect(await ejecutar(permisoGuard('verVentas'))).toBe(true);
  });
});

describe('AuthService.emailDeUsuario', () => {
  it('normaliza el usuario al correo interno de Firebase Auth', () => {
    expect(AuthService.emailDeUsuario('  Samuel ')).toBe('samuel@restaurante-smart-c1de7.web.app');
  });
});
