import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, query, addDoc, updateDoc, doc, getDocs } from '@angular/fire/firestore';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ItemComanda, actualizarItems, calcularTotal, quitarItem } from '../services/comandas';

@Component({
  selector: 'app-admin-mesas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mis-mesas.html'
})
export class AdminMesasComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  readonly puedeCobrar = inject(AuthService).puedeCobrar;

  mesas: any[] = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, comanda: null }));

  categoriasMenu: { nombre: string, platos: any[] }[] = [];
  categoriaExpandida: string = '';

  comandaSeleccionada: any = null;
  mostrarModal: boolean = false;

  async ngOnInit() {
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

      if (this.categoriasMenu.length > 0) {
        this.categoriaExpandida = this.categoriasMenu[0].nombre;
      }

      this.cdr.detectChanges();
    } catch (e) {
      console.error("Fallo crítico al leer platos de Firebase:", e);
    }

    const q = query(collection(this.firestore, 'comandas'));
    this.destroyRef.onDestroy(onSnapshot(q, (snap) => {
      this.mesas.forEach(m => m.comanda = null);
      snap.docs.forEach(d => {
        const data = d.data() as any;
        if (data.estado !== 'Pagada') {
          const mesaIndex = data.numeroMesa - 1;
          if (this.mesas[mesaIndex]) {
            this.mesas[mesaIndex].comanda = { id: d.id, ...data };
          }
        }
        // Si la comanda abierta en el panel cambia (p. ej. cocina marca un plato),
        // el panel se actualiza en vez de quedarse con una copia antigua.
        if (this.comandaSeleccionada?.id === d.id) {
          this.comandaSeleccionada = { id: d.id, ...structuredClone(data) };
        }
      });
      this.cdr.detectChanges();
    }));
  }

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
        estado: 'nuevo',
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

    const nuevo: ItemComanda = {
      id: crypto.randomUUID(),
      name: producto.nombre || producto.name || 'Sin nombre',
      price: Number(producto.precio || producto.price) || 0,
      estado: 'nuevo',
      categoria: producto.categoria || producto.category || 'Otros'
    };

    await this.modificarItems((items) => [...items, nuevo]);
  }

  async eliminarPlatoDeComanda(index: number) {
    const objetivo = this.comandaSeleccionada?.items?.[index];
    if (!objetivo) return;
    await this.modificarItems((items) => quitarItem(items, objetivo));
  }

  /**
   * Aplica un cambio a los items. Si la comanda ya está guardada, se hace en una
   * transacción sobre los datos del servidor (ver actualizarItems) para no pisar
   * lo que haya cambiado cocina u otro camarero mientras el panel estaba abierto.
   */
  private async modificarItems(cambio: (items: ItemComanda[]) => ItemComanda[]) {
    const comanda = this.comandaSeleccionada;
    if (!comanda) return;

    if (!comanda.id) {
      // Comanda nueva todavía sin guardar: solo existe en este panel.
      comanda.items = cambio(comanda.items ?? []);
      comanda.total = calcularTotal(comanda.items);
      this.cdr.detectChanges();
      return;
    }

    try {
      const { items, total } = await actualizarItems(this.firestore, comanda.id, cambio);
      if (this.comandaSeleccionada?.id === comanda.id) {
        this.comandaSeleccionada.items = items;
        this.comandaSeleccionada.total = total;
      }
    } catch (error) {
      console.error('Error al actualizar la comanda:', error);
      this.toast.show('No se ha podido actualizar la comanda', 'error');
    }
    this.cdr.detectChanges();
  }

  async guardarNuevaComanda() {
    if (!this.comandaSeleccionada || this.comandaSeleccionada.id) return;
    try {
      this.comandaSeleccionada.fechaCreacion = new Date();
      this.comandaSeleccionada.fecha = new Date().toISOString();
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
    if (!this.puedeCobrar()) {
      this.toast.show('No tienes permiso para cobrar mesas', 'error');
      return;
    }
    
    if (this.comandaSeleccionada.estado?.toLowerCase() !== 'entregado') {
      const platosPendientes = this.comandaSeleccionada.items?.filter((item: any) => {
        const cat = item.categoria ? item.categoria.toLowerCase().trim() : '';
        if (cat === 'bebidas' || cat === 'bebida' || cat === 'refrescos') return false; 
        
        const nom = item.name ? item.name.toLowerCase() : '';
        if (nom.includes('refresco') || nom.includes('agua') || nom.includes('cerveza') || nom.includes('vino') || nom.includes('café')) return false;

        return item.estado !== 'listo'; 
      }) || [];

      if (platosPendientes.length > 0) {
        const nombresFaltantes = Array.from(new Set(platosPendientes.map((p: any) => p.name))).join(', ');
        alert(`⛔ No se puede cobrar por tarjeta. Faltan platos por terminar en cocina: [ ${nombresFaltantes} ]`);
        return; 
      }
    }

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
    if (!this.puedeCobrar()) {
      this.toast.show('No tienes permiso para cobrar mesas', 'error');
      return;
    }

    if (this.comandaSeleccionada.estado?.toLowerCase() !== 'entregado') {
      const platosPendientes = this.comandaSeleccionada.items?.filter((item: any) => {
        const cat = item.categoria ? item.categoria.toLowerCase().trim() : '';
        if (cat === 'bebidas' || cat === 'bebida' || cat === 'refrescos') return false; 
        
        const nom = item.name ? item.name.toLowerCase() : '';
        if (nom.includes('refresco') || nom.includes('agua') || nom.includes('cerveza') || nom.includes('vino') || nom.includes('café')) return false;

        return item.estado !== 'listo'; 
      }) || [];

      if (platosPendientes.length > 0) {
        const nombresFaltantes = Array.from(new Set(platosPendientes.map((p: any) => p.name))).join(', ');
        alert(`⛔ No se puede cobrar en efectivo. Faltan platos por terminar en cocina: [ ${nombresFaltantes} ]`);
        return; 
      }
    }

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