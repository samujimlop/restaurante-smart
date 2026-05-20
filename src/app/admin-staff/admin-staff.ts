import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-staff.html'
})
export class AdminStaffComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  empleados: any[] = [];
  mostrarModal = false;
  editandoId: string | null = null; // NUEVO: Para saber a quién estamos editando

  nuevoEmpleado = {
    nombre: '',
    usuario: '',
    email: '',
    rol: 'Camarero',
    pin: '',
    permisos: {
      verVentas: false,
      cobrarMesas: false,
      verInventario: false
    }
  };

  ngOnInit() {
    const ref = collection(this.firestore, 'usuarios');
    onSnapshot(ref, (snap) => {
      this.empleados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.cdr.detectChanges();
    });
  }

  abrirModal() {
    this.resetForm();
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.resetForm();
  }

  // NUEVO: Función para rellenar el formulario con el empleado seleccionado
  editarEmpleado(emp: any) {
    this.editandoId = emp.id;
    this.nuevoEmpleado = {
      nombre: emp.nombre || '',
      usuario: emp.usuario || '',
      email: emp.email || '',
      rol: emp.rol || 'Camarero',
      pin: emp.pin || '',
      // Si es un empleado antiguo y no tenía permisos, le creamos el bloque a false
      permisos: emp.permisos || { verVentas: false, cobrarMesas: false, verInventario: false }
    };
    this.mostrarModal = true;
  }

  async guardarEmpleado() {
    if (!this.nuevoEmpleado.nombre || !this.nuevoEmpleado.usuario || !this.nuevoEmpleado.pin) {
      alert("Por favor, rellena Nombre, Usuario y PIN");
      return;
    }

    if (this.nuevoEmpleado.rol === 'Gerente') {
      this.nuevoEmpleado.permisos = { verVentas: true, cobrarMesas: true, verInventario: true };
    }

    try {
      if (this.editandoId) {
        // Si estamos editando, ACTUALIZAMOS
        await updateDoc(doc(this.firestore, `usuarios/${this.editandoId}`), {
          nombre: this.nuevoEmpleado.nombre,
          usuario: this.nuevoEmpleado.usuario,
          email: this.nuevoEmpleado.email,
          rol: this.nuevoEmpleado.rol,
          pin: this.nuevoEmpleado.pin,
          permisos: this.nuevoEmpleado.permisos
        });
      } else {
        // Si es nuevo, CREAMOS
        await addDoc(collection(this.firestore, 'usuarios'), {
          nombre: this.nuevoEmpleado.nombre,
          usuario: this.nuevoEmpleado.usuario,
          email: this.nuevoEmpleado.email,
          rol: this.nuevoEmpleado.rol,
          pin: this.nuevoEmpleado.pin,
          permisos: this.nuevoEmpleado.permisos,
          fechaAlta: new Date()
        });
      }
      this.cerrarModal();
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      alert("Hubo un error al conectar con la base de datos.");
    }
  }

  async borrarEmpleado(id: string) {
    if (confirm('¿Eliminar este acceso permanentemente?')) {
      await deleteDoc(doc(this.firestore, `usuarios/${id}`));
    }
  }

  resetForm() {
    this.editandoId = null;
    this.nuevoEmpleado = {
      nombre: '',
      usuario: '',
      email: '',
      rol: 'Camarero',
      pin: '',
      permisos: { verVentas: false, cobrarMesas: false, verInventario: false }
    };
  }
}