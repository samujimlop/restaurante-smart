import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { ToastService } from '../services/toast.service';

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
  private toast = inject(ToastService);
  
  listaReservas: any[] = [];

  ngOnInit() {
    // Reservas desde hace una semana en adelante (las antiguas no hace falta descargarlas).
    // La fecha se guarda como texto 'AAAA-MM-DD', que se ordena igual que la fecha.
    const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ref = query(collection(this.firestore, 'reservas'), where('fecha', '>=', haceUnaSemana));
    
    this.destroyRef.onDestroy(onSnapshot(ref, (snapshot) => {
      const arrayTemporal: any[] = [];
      snapshot.forEach((documento) => {
        arrayTemporal.push({ id: documento.id, ...documento.data() });
      });
      
      // Por fecha y hora: las más próximas primero
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
      this.toast.show('No se ha podido actualizar la reserva', 'error');
    }
  }

  // Función para eliminar definitivamente
  async borrarReserva(id: string) {
    if (!confirm("¿Estás seguro de que quieres borrar esta reserva del sistema?")) return;
    try {
      await deleteDoc(doc(this.firestore, `reservas/${id}`));
    } catch (error) {
      console.error("Error al borrar la reserva:", error);
      this.toast.show('No se ha podido borrar la reserva', 'error');
    }
  }
}