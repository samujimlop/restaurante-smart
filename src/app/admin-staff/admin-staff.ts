import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Firestore,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import {
  AuthService,
  PATRON_PIN,
  PATRON_USUARIO,
  PerfilEmpleado,
  PermisosEmpleado,
} from '../services/auth.service';

type EmpleadoListado = PerfilEmpleado & { id: string };

const PERMISOS_VACIOS: PermisosEmpleado = {
  verVentas: false,
  cobrarMesas: false,
  verInventario: false,
};

@Component({
  selector: 'app-admin-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-staff.html',
})
export class AdminStaffComponent implements OnInit {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  empleados: EmpleadoListado[] = [];
  mostrarModal = false;
  editandoId: string | null = null;
  guardando = false;
  errorMsg = '';

  nuevoEmpleado = this.formularioVacio();

  ngOnInit() {
    const cancelar = onSnapshot(collection(this.firestore, 'usuarios'), (snap) => {
      this.empleados = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PerfilEmpleado) }));
      this.cdr.detectChanges();
    });
    this.destroyRef.onDestroy(cancelar);
  }

  abrirModal() {
    this.resetForm();
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.resetForm();
  }

  editarEmpleado(emp: EmpleadoListado) {
    this.resetForm();
    this.editandoId = emp.id;
    this.nuevoEmpleado = {
      nombre: emp.nombre || '',
      usuario: emp.usuario || '',
      email: emp.email || '',
      rol: emp.rol || 'Camarero',
      pin: '',
      permisos: { ...PERMISOS_VACIOS, ...emp.permisos },
    };
    this.mostrarModal = true;
  }

  async guardarEmpleado() {
    this.errorMsg = '';
    const datos = this.nuevoEmpleado;
    datos.usuario = datos.usuario.trim().toLowerCase();

    if (!datos.nombre.trim()) {
      this.errorMsg = 'Escribe el nombre del empleado.';
      return;
    }
    if (!this.editandoId) {
      if (!PATRON_USUARIO.test(datos.usuario)) {
        this.errorMsg =
          'Usuario de 3 a 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.';
        return;
      }
      if (!PATRON_PIN.test(datos.pin)) {
        this.errorMsg = 'El PIN debe tener exactamente 6 cifras.';
        return;
      }
    }

    const permisos =
      datos.rol === 'Gerente'
        ? { verVentas: true, cobrarMesas: true, verInventario: true }
        : datos.permisos;

    this.guardando = true;
    try {
      if (this.editandoId) {
        await updateDoc(doc(this.firestore, 'usuarios', this.editandoId), {
          nombre: datos.nombre.trim(),
          email: datos.email,
          rol: datos.rol,
          permisos,
        });
      } else {
        // 1) Cuenta de Firebase Auth (el PIN es su contraseña y no se guarda en Firestore)
        const uid = await this.auth.crearCuentaEmpleado(datos.usuario, datos.pin);
        // 2) Perfil con el rol, en usuarios/{uid}
        await setDoc(doc(this.firestore, 'usuarios', uid), {
          nombre: datos.nombre.trim(),
          usuario: datos.usuario,
          email: datos.email,
          rol: datos.rol,
          permisos,
          fechaAlta: new Date(),
        });
      }
      this.cerrarModal();
    } catch (error: unknown) {
      const codigo = (error as { code?: string })?.code;
      this.errorMsg =
        codigo === 'auth/email-already-in-use'
          ? 'Ese nombre de usuario ya existe.'
          : 'No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.';
      console.error('Error al guardar el empleado:', error);
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  async borrarEmpleado(id: string) {
    // Al borrar el perfil, la cuenta de Auth deja de tener acceso: las reglas de
    // Firestore exigen que exista usuarios/{uid}.
    if (confirm('¿Eliminar este acceso permanentemente?')) {
      await deleteDoc(doc(this.firestore, 'usuarios', id));
    }
  }

  resetForm() {
    this.editandoId = null;
    this.errorMsg = '';
    this.nuevoEmpleado = this.formularioVacio();
  }

  private formularioVacio() {
    return {
      nombre: '',
      usuario: '',
      email: '',
      rol: 'Camarero',
      pin: '',
      permisos: { ...PERMISOS_VACIOS },
    };
  }
}
