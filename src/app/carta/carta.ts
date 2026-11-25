import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, addDoc } from '@angular/fire/firestore';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './carta.html'
})
export class CartaComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  /** Hoy en formato 'AAAA-MM-DD' (hora local), para no aceptar reservas en el pasado. */
  readonly hoy = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  platos: any[] = [];
  categorias: string[] = [];
  categoriaSeleccionada: string = '';

  mostrarFormulario: boolean = false;
  nuevaReserva = { nombre: '', telefono: '', fecha: '', hora: '', personas: 1 };

  async ngOnInit() {
    try {
      const snap = await getDocs(collection(this.firestore, 'platos'));
      this.platos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const cats = new Set<string>();
      this.platos.forEach(p => {
        const cat = p.category;
        if (cat) cats.add(cat);
      });
      this.categorias = Array.from(cats);

      if (this.categorias.length > 0) {
        this.categoriaSeleccionada = this.categorias[0];
      }

      this.cdr.detectChanges(); 

    } catch (error) {
      console.error("Error cargando la carta:", error);
    }
  }

  seleccionarCategoria(cat: string) {
    this.categoriaSeleccionada = cat;
    this.cdr.detectChanges(); 
  }

  abrirReserva() {
    this.mostrarFormulario = true;
  }

  cerrarReserva() {
    this.mostrarFormulario = false;
  }

  async enviarReserva() {
    if (!this.nuevaReserva.nombre.trim() || !this.nuevaReserva.fecha || !this.nuevaReserva.hora) {
      this.toast.show('Rellena los campos obligatorios (*)', 'error');
      return;
    }
    if (this.nuevaReserva.fecha < this.hoy) {
      this.toast.show('La fecha de la reserva no puede ser anterior a hoy', 'error');
      return;
    }

    try {
      await addDoc(collection(this.firestore, 'reservas'), {
        ...this.nuevaReserva,
        estado: 'Pendiente',
        fechaCreacion: new Date()
      });
      
      this.toast.show('¡Reserva enviada! Te esperamos.', 'success');
      this.cerrarReserva();
      this.nuevaReserva = { nombre: '', telefono: '', fecha: '', hora: '', personas: 1 };
    } catch (error) {
      console.error("Error al guardar reserva:", error);
      this.toast.show('No se ha podido enviar la reserva. Inténtalo de nuevo.', 'error');
    }
  }
}