import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './carta.html'
})
export class CartaComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef); // Añadimos esto

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
        // En tu Firebase la clave es 'category'
        const cat = p.category;
        if (cat) cats.add(cat);
      });
      this.categorias = Array.from(cats);

      if (this.categorias.length > 0) {
        this.categoriaSeleccionada = this.categorias[0];
      }

      // IMPORTANTE: Forzamos a Angular a actualizar la vista
      this.cdr.detectChanges(); 

    } catch (error) {
      console.error("Error cargando la carta:", error);
    }
  }

  seleccionarCategoria(cat: string) {
    this.categoriaSeleccionada = cat;
    // Forzamos actualización al cambiar de pestaña
    this.cdr.detectChanges(); 
  }

  // --- LÓGICA DEL MODAL DE RESERVAS ---

  abrirReserva() {
    this.mostrarFormulario = true;
  }

  cerrarReserva() {
    this.mostrarFormulario = false;
  }

  async enviarReserva() {
    if (!this.nuevaReserva.nombre || !this.nuevaReserva.fecha || !this.nuevaReserva.hora) {
      alert('Por favor, rellena los campos obligatorios (*)');
      return;
    }

    try {
      await addDoc(collection(this.firestore, 'reservas'), {
        ...this.nuevaReserva,
        estado: 'Pendiente',
        fechaCreacion: new Date()
      });
      
      alert('¡Reserva confirmada con éxito!');
      this.cerrarReserva();
      this.nuevaReserva = { nombre: '', telefono: '', fecha: '', hora: '', personas: 1 };
    } catch (error) {
      console.error("Error al guardar reserva:", error);
      alert('Hubo un error al procesar la reserva.');
    }
  }
}