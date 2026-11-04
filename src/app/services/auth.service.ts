import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { getApps, initializeApp } from 'firebase/app';
import {
  Auth as AuthFirebase,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signOut as signOutFirebase,
} from 'firebase/auth';

import { DOMINIO_EMPLEADOS, firebaseConfig } from '../firebase.config';

export interface PermisosEmpleado {
  verVentas: boolean;
  cobrarMesas: boolean;
  verInventario: boolean;
}

export interface PerfilEmpleado {
  nombre: string;
  usuario: string;
  rol: string;
  email?: string;
  permisos?: PermisosEmpleado;
}

/** Roles con acceso a la zona de gerencia (mismo criterio que firestore.rules). */
const ROLES_GERENCIA = ['gerente', 'admin', 'administrador', 'jefe'];
const ROLES_COCINA = ['cocinero', 'cocina'];

export const PATRON_USUARIO = /^[a-z0-9._-]{3,30}$/;
export const PATRON_PIN = /^\d{6}$/;

/**
 * Sesión de los empleados con Firebase Authentication.
 *
 * - El PIN nunca se guarda en Firestore: es la contraseña de la cuenta de Auth,
 *   que Firebase almacena con hash (scrypt) y protege frente a fuerza bruta.
 * - El rol se lee de `usuarios/{uid}`, documento que solo puede escribir un gerente
 *   según las reglas de Firestore. Modificar el navegador no da permisos reales.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  readonly perfil = signal<PerfilEmpleado | null>(null);
  readonly rol = computed(() => (this.perfil()?.rol ?? '').toLowerCase());
  readonly esGerente = computed(() => ROLES_GERENCIA.includes(this.rol()));
  readonly esCocina = computed(() => ROLES_COCINA.includes(this.rol()));

  private readonly sesionInicial: Promise<void>;
  private authAltas?: AuthFirebase;

  constructor() {
    this.sesionInicial = new Promise((resolve) => {
      onAuthStateChanged(this.auth, async (user) => {
        this.perfil.set(user ? await this.cargarPerfil(user.uid) : null);
        resolve();
      });
    });
  }

  static emailDeUsuario(usuario: string): string {
    return `${usuario.trim().toLowerCase()}@${DOMINIO_EMPLEADOS}`;
  }

  /** Espera a que Firebase restaure la sesión guardada y devuelve el perfil. */
  async esperarSesion(): Promise<PerfilEmpleado | null> {
    await this.sesionInicial;
    return this.perfil();
  }

  async login(usuario: string, pin: string): Promise<PerfilEmpleado> {
    const credencial = await signInWithEmailAndPassword(
      this.auth,
      AuthService.emailDeUsuario(usuario),
      pin,
    );
    const perfil = await this.cargarPerfil(credencial.user.uid);
    if (!perfil) {
      await signOut(this.auth);
      throw new Error('sin-acceso');
    }
    this.perfil.set(perfil);
    return perfil;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.perfil.set(null);
  }

  /**
   * Crea la cuenta de Auth de un empleado nuevo y devuelve su uid.
   * Usa una instancia secundaria de Firebase con persistencia en memoria para
   * que el gerente que da el alta no pierda su propia sesión.
   */
  async crearCuentaEmpleado(usuario: string, pin: string): Promise<string> {
    if (!this.authAltas) {
      const app =
        getApps().find((a) => a.name === 'altas-empleados') ??
        initializeApp(firebaseConfig, 'altas-empleados');
      this.authAltas = initializeAuth(app, { persistence: inMemoryPersistence });
    }
    const credencial = await createUserWithEmailAndPassword(
      this.authAltas,
      AuthService.emailDeUsuario(usuario),
      pin,
    );
    await signOutFirebase(this.authAltas);
    return credencial.user.uid;
  }

  private async cargarPerfil(uid: string): Promise<PerfilEmpleado | null> {
    try {
      const snap = await getDoc(doc(this.firestore, 'usuarios', uid));
      return snap.exists() ? (snap.data() as PerfilEmpleado) : null;
    } catch {
      // Sin documento de perfil (o acceso revocado): las reglas deniegan la lectura.
      return null;
    }
  }
}
