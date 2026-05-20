import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, query, addDoc, updateDoc, doc, getDocs } from '@angular/fire/firestore';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-admin-mesas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mis-mesas.html'
})
export class AdminMesasComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  mesas: any[] = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, comanda: null }));

  // Variables obligatorias para el sistema de desplegables por categorías
  categoriasMenu: { nombre: string, platos: any[] }[] = [];
  categoriaExpandida: string = '';

  comandaSeleccionada: any = null;
  mostrarModal: boolean = false;

  async ngOnInit() {
    // 1. CARGA DIRECTA A TU COLECCIÓN REAL 'platos' Y AGRUPACIÓN POR CATEGORÍA
    try {
      const productosSnap = await getDocs(collection(this.firestore, 'platos'));
      const platosRaw = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const categoriasMap = new Map<string, any[]>();
      platosRaw.forEach((plato: any) => {
        const cat = plato.categoria || plato.category || 'Otros';
        if (!categoriasMap.has(cat)) {
          categoriasMap.set(cat, []);
        }
        categoriasMap.get(cat)!.push(plato);
      });

      this.categoriasMenu = Array.from(categoriasMap.entries()).map(([nombre, platos]) => ({ nombre, platos }));

      // Abrimos la primera categoría automáticamente al cargar
      if (this.categoriasMenu.length > 0) {
        this.categoriaExpandida = this.categoriasMenu[0].nombre;
      }

      this.cdr.detectChanges();
    } catch (e) {
      console.error("Fallo crítico al leer platos de Firebase:", e);
    }

    // 2. ESCUCHA EN TIEMPO REAL DE COMANDAS ACTIVAS
    const q = query(collection(this.firestore, 'comandas'));
    onSnapshot(q, (snap) => {
      this.mesas.forEach(m => m.comanda = null);
      snap.docs.forEach(d => {
        const data = d.data() as any;
        if (data.estado !== 'Pagada') {
          const mesaIndex = data.numeroMesa - 1;
          if (this.mesas[mesaIndex]) {
            this.mesas[mesaIndex].comanda = { id: d.id, ...data };
          }
        }
      });
      this.cdr.detectChanges();
    });
  }

  // Abre o cierra las pestañas de las categorías
  toggleCategoria(categoria: string) {
    this.categoriaExpandida = this.categoriaExpandida === categoria ? '' : categoria;
    this.cdr.detectChanges();
  }

  async abrirMesa(mesa: any) {
    if (mesa.comanda) {
      this.comandaSeleccionada = JSON.parse(JSON.stringify(mesa.comanda));
    } else {
      this.comandaSeleccionada = {
        numeroMesa: mesa.numero,
        estado: 'Abierta',
        items: [],
        total: 0
      };
    }
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  async agregarPlatoAComanda(producto: any) {
    if (!this.comandaSeleccionada) return;
    if (!this.comandaSeleccionada.items) this.comandaSeleccionada.items = [];

    const precioSeguro = Number(producto.precio || producto.price) || 0;
    const nombreSeguro = producto.nombre || producto.name || 'Sin nombre';

    this.comandaSeleccionada.items.push({
      name: nombreSeguro,
      price: precioSeguro
    });

    this.comandaSeleccionada.total = this.comandaSeleccionada.items.reduce((acc: number, item: any) => acc + item.price, 0);

    if (this.comandaSeleccionada.id) {
      await updateDoc(doc(this.firestore, `comandas/${this.comandaSeleccionada.id}`), {
        items: this.comandaSeleccionada.items,
        total: this.comandaSeleccionada.total
      });
    }
    this.cdr.detectChanges();
  }

  async eliminarPlatoDeComanda(index: number) {
    if (!this.comandaSeleccionada || !this.comandaSeleccionada.items) return;
    this.comandaSeleccionada.items.splice(index, 1);
    this.comandaSeleccionada.total = this.comandaSeleccionada.items.reduce((acc: number, item: any) => acc + item.price, 0);

    if (this.comandaSeleccionada.id) {
      await updateDoc(doc(this.firestore, `comandas/${this.comandaSeleccionada.id}`), {
        items: this.comandaSeleccionada.items,
        total: this.comandaSeleccionada.total
      });
    }
    this.cdr.detectChanges();
  }

  async guardarNuevaComanda() {
    if (!this.comandaSeleccionada || this.comandaSeleccionada.id) return;
    try {
      this.comandaSeleccionada.fechaCreacion = new Date();
      const docRef = await addDoc(collection(this.firestore, 'comandas'), this.comandaSeleccionada);
      this.comandaSeleccionada.id = docRef.id;
      this.cerrarModal();
      this.toast.show('Comanda abierta correctamente', 'success');
    } catch (error) {
      console.error("Error al guardar:", error);
      this.toast.show('Error al guardar la comanda', 'error');
    }
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.comandaSeleccionada = null;
    this.cdr.detectChanges();
  }

  async aprobarPagoTarjeta() {
    if (!this.comandaSeleccionada || !this.comandaSeleccionada.id) return;
    try {
      await updateDoc(doc(this.firestore, `comandas/${this.comandaSeleccionada.id}`), {
        estado: 'Aprobada_Para_Pago'
      });
      this.cerrarModal();
      this.toast.show('Pendiente de pago en datáfono', 'info');
    } catch (error) { 
      this.toast.show('Error al actualizar estado', 'error');
    }
  }

  async cobrarEnEfectivo() {
    if (!this.comandaSeleccionada || !this.comandaSeleccionada.id) return;
    try {
      await updateDoc(doc(this.firestore, `comandas/${this.comandaSeleccionada.id}`), {
        estado: 'Pagada',
        fechaFinalizacion: new Date()
      });
      this.cerrarModal();
      this.toast.show('Mesa cobrada en efectivo', 'success');
    } catch (error) { 
      this.toast.show('Error al cobrar', 'error');
    }
  }
}