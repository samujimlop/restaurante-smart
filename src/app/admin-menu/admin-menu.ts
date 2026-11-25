import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Firestore,
  collection,
  onSnapshot,
  doc,
  deleteField,
  writeBatch,
} from '@angular/fire/firestore';
import { ToastService } from '../services/toast.service';

/**
 * Los platos (colección `platos`) son públicos: la carta los lee sin iniciar
 * sesión. El coste de escandallo es información interna, así que vive aparte,
 * en `platos_costes/{idPlato}`, que solo gerencia puede leer (firestore.rules).
 */
@Component({
  selector: 'app-admin-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-menu.html'
})
export class AdminMenuComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  listaPlatos: any[] = [];
  mostrarModal = false;
  editandoId: string | null = null;

  categorias = ['Entrantes', 'Principales', 'Postres', 'Bebidas'];
  opcionesAllergens = ['Gluten', 'Lactosa', 'Huevo', 'Pescado', 'Frutos Cáscara', 'Soja', 'Crustáceos', 'Mostaza'];

  nuevoPlato: any = this.platoVacio();

  private platos: any[] = [];
  private costes = new Map<string, number>();

  ngOnInit() {
    this.destroyRef.onDestroy(onSnapshot(collection(this.firestore, 'platos'), (snapshot) => {
      this.platos = snapshot.docs.map((documento) => {
        const data = documento.data();
        return {
          id: documento.id,
          ...data,
          allergens: Array.isArray(data['allergens']) ? data['allergens'] : []
        };
      });
      this.migrarCostesPublicos();
      this.combinar();
    }));

    this.destroyRef.onDestroy(onSnapshot(collection(this.firestore, 'platos_costes'), (snapshot) => {
      this.costes = new Map(snapshot.docs.map((d) => [d.id, Number(d.data()['costPrice']) || 0]));
      this.combinar();
    }));
  }

  /** Une cada plato con su coste privado para mostrarlos juntos en la tabla. */
  private combinar() {
    this.listaPlatos = this.platos.map((p) => ({
      ...p,
      costPrice: this.costes.get(p.id) ?? p.costPrice ?? 0,
    }));
    this.cdr.detectChanges();
  }

  /**
   * Platos creados antes de separar los costes: todavía guardan `costPrice` en el
   * documento público. Se mueve a `platos_costes` y se borra del plato.
   */
  private async migrarCostesPublicos() {
    const pendientes = this.platos.filter((p) => p.costPrice !== undefined);
    if (pendientes.length === 0) return;
    const lote = writeBatch(this.firestore);
    for (const plato of pendientes) {
      lote.set(doc(this.firestore, 'platos_costes', plato.id), { costPrice: Number(plato.costPrice) || 0 });
      lote.update(doc(this.firestore, 'platos', plato.id), { costPrice: deleteField() });
    }
    try {
      await lote.commit();
    } catch (error) {
      console.error('Error al mover los costes a platos_costes:', error);
    }
  }

  toggleAllergen(alergeno: string) {
    const index = this.nuevoPlato.allergens.indexOf(alergeno);
    if (index > -1) {
      this.nuevoPlato.allergens.splice(index, 1);
    } else {
      this.nuevoPlato.allergens.push(alergeno);
    }
  }

  abrir() {
    this.editandoId = null;
    this.resetearForm();
    this.mostrarModal = true;
  }

  editar(plato: any) {
    this.editandoId = plato.id;
    this.nuevoPlato = {
      name: plato.name ?? '',
      description: plato.description ?? '',
      price: plato.price ?? null,
      costPrice: plato.costPrice ?? null,
      category: plato.category ?? 'Entrantes',
      allergens: Array.isArray(plato.allergens) ? [...plato.allergens] : []
    };
    this.mostrarModal = true;
  }

  async guardar() {
    const precio = Number(this.nuevoPlato.price);
    if (!this.nuevoPlato.name?.trim() || !(precio > 0)) {
      this.toast.show('Nombre y precio obligatorios', 'error');
      return;
    }

    // Datos públicos del plato (sin id ni coste) y coste privado, en un solo lote.
    const publico = {
      name: this.nuevoPlato.name.trim(),
      description: this.nuevoPlato.description ?? '',
      price: precio,
      category: this.nuevoPlato.category,
      allergens: this.nuevoPlato.allergens ?? [],
    };
    const refPlato = this.editandoId
      ? doc(this.firestore, 'platos', this.editandoId)
      : doc(collection(this.firestore, 'platos'));

    const lote = writeBatch(this.firestore);
    lote.set(refPlato, publico, { merge: true });
    lote.set(doc(this.firestore, 'platos_costes', refPlato.id), {
      costPrice: Number(this.nuevoPlato.costPrice) || 0,
    });

    try {
      await lote.commit();
      this.cerrar();
      this.toast.show('Plato guardado', 'success');
    } catch (e) {
      console.error('Error al guardar el plato:', e);
      this.toast.show('No se ha podido guardar el plato', 'error');
    }
  }

  cerrar() { this.mostrarModal = false; }

  async borrar(id: string) {
    if (!confirm("¿Eliminar este plato del menú?")) return;
    const lote = writeBatch(this.firestore);
    lote.delete(doc(this.firestore, 'platos', id));
    lote.delete(doc(this.firestore, 'platos_costes', id));
    try {
      await lote.commit();
    } catch (e) {
      console.error('Error al borrar el plato:', e);
      this.toast.show('No se ha podido borrar el plato', 'error');
    }
  }

  resetearForm() {
    this.nuevoPlato = this.platoVacio();
  }

  private platoVacio() {
    return { name: '', description: '', price: null, costPrice: null, category: 'Entrantes', allergens: [] as string[] };
  }
}
