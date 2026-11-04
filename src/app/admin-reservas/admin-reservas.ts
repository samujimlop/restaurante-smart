import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-reservas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-reservas.html'
})
export class AdminReservasComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  
  listaReservas: any[] = [];

  ngOnInit() {
    // Nos conectamos a la colección de reservas en tiempo real
    const ref = collection(this.firestore, 'reservas');
    
    this.destroyRef.onDestroy(onSnapshot(ref, (snapshot) => {
      const arrayTemporal: any[] = [];
      snapshot.forEach((documento) => {
        arrayTemporal.push({ id: documento.id, ...documento.data() });
      });
      
      // Ordenamos para que las reservas más recientes salgan primero
      this.listaReservas = arrayTemporal.sort((a, b) => {
        if (a.fecha > b.fecha) return 1;
        if (a.fecha < b.fecha) return -1;
        return a.hora > b.hora ? 1 : -1;
      });
      
      this.cdr.detectChanges();
    }, (error) => console.error("Error al cargar reservas:", error)));
  }

  // Función para cambiar el estado de la reserva
  async cambiarEstado(id: string, nuevoEstado: string) {
    try {
      await updateDoc(doc(this.firestore, `reservas/${id}`), { estado: nuevoEstado });
    } catch (error) {
      console.error("Error al actualizar estado:", error);
    }
  }

  // Función para eliminar definitivamente
  async borrarReserva(id: string) {
    if (confirm("¿Estás seguro de que quieres borrar esta reserva del sistema?")) {
      await deleteDoc(doc(this.firestore, `reservas/${id}`));
    }
  }
}