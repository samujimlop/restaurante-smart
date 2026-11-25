import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, query, addDoc, updateDoc, doc, getDocs, where } from '@angular/fire/firestore';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import {
  ItemComanda,
  MetodoPago,
  actualizarItems,
  calcularTotal,
  estadoTrasAnadir,
  platosPendientes,
  quitarItem,
} from '../services/comandas';

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

    // Solo las comandas abiertas: las pagadas no hacen falta aquí y crecen cada día.
    const q = query(collection(this.firestore, 'comandas'), where('estado', '!=', 'Pagada'));
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

    // Si la comanda ya había salido de cocina, un plato nuevo la devuelve a la cola.
    await this.modificarItems(
      (items) => [...items, nuevo],
      (estadoActual) => estadoTrasAnadir(estadoActual, nuevo),
    );
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
  private async modificarItems(
    cambio: (items: ItemComanda[]) => ItemComanda[],
    nuevoEstado?: (estadoActual: string | undefined) => string | null,
  ) {
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
      const { items, total, estado } = await actualizarItems(
        this.firestore,
        comanda.id,
        cambio,
        nuevoEstado,
      );
      if (this.comandaSeleccionada?.id === comanda.id) {
        this.comandaSeleccionada.items = items;
        this.comandaSeleccionada.total = total;
        if (estado) this.comandaSeleccionada.estado = estado;
      }
    } catch (error) {
      console.error('Error al actualizar la comanda:', error);
      this.toast.show('No se ha podido actualizar la comanda', 'error');
    }
    this.cdr.detectChanges();
  }

  async guardarNuevaComanda() {
    if (!this.comandaSeleccionada || this.comandaSeleccionada.id) return;

    // Otro camarero puede haber abierto esta mesa mientras el panel estaba abierto:
    // en vez de crear una segunda comanda, se abre la que ya existe.
    const abierta = this.mesas[this.comandaSeleccionada.numeroMesa - 1]?.comanda;
    if (abierta) {
      this.comandaSeleccionada = JSON.parse(JSON.stringify(abierta));
      this.toast.show('Esta mesa ya tiene una comanda abierta: añade los platos aquí', 'info');
      this.cdr.detectChanges();
      return;
    }

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

  /** Paso 1 del pago con tarjeta: la mesa queda pendiente del datáfono (amarilla). */
  async aprobarPagoTarjeta() {
    if (!this.puedeIniciarCobro('tarjeta')) return;
    try {
      await updateDoc(doc(this.firestore, `comandas/${this.comandaSeleccionada.id}`), {
        estado: 'Aprobada_Para_Pago'
      });
      this.cerrarModal();
      this.toast.show('Pendiente de pago en datáfono', 'info');
    } catch (error) {
      console.error('Error al aprobar el pago con tarjeta:', error);
      this.toast.show('Error al actualizar estado', 'error');
    }
  }

  /** Paso 2 del pago con tarjeta: el datáfono lo ha aceptado y la mesa se cierra. */
  async confirmarPagoTarjeta() {
    if (this.comandaSeleccionada?.estado !== 'Aprobada_Para_Pago') return;
    if (!this.comprobarPermisoCobro()) return;
    await this.cerrarComanda('tarjeta');
  }

  async cobrarEnEfectivo() {
    if (!this.puedeIniciarCobro('efectivo')) return;
    await this.cerrarComanda('efectivo');
  }

  private comprobarPermisoCobro(): boolean {
    if (!this.comandaSeleccionada?.id) return false;
    if (!this.puedeCobrar()) {
      this.toast.show('No tienes permiso para cobrar mesas', 'error');
      return false;
    }
    return true;
  }

  /**
   * No se cobra una mesa con platos sin terminar. Si la comanda ya está
   * entregada, cocina ha acabado: añadir un plato después la devuelve a 'nuevo'
   * (ver estadoTrasAnadir), así que 'entregado' garantiza que no queda nada.
   */
  private puedeIniciarCobro(metodo: MetodoPago): boolean {
    if (!this.comprobarPermisoCobro()) return false;
    if (this.comandaSeleccionada.estado?.toLowerCase() === 'entregado') return true;

    const pendientes = platosPendientes(this.comandaSeleccionada.items);
    if (pendientes.length > 0) {
      const nombres = Array.from(new Set(pendientes.map((p) => p.name))).join(', ');
      const como = metodo === 'tarjeta' ? 'por tarjeta' : 'en efectivo';
      this.toast.show(`No se puede cobrar ${como}: faltan en cocina ${nombres}`, 'error');
      return false;
    }
    return true;
  }

  private async cerrarComanda(metodoPago: MetodoPago) {
    try {
      await updateDoc(doc(this.firestore, `comandas/${this.comandaSeleccionada.id}`), {
        estado: 'Pagada',
        metodoPago,
        fechaFinalizacion: new Date()
      });
      this.cerrarModal();
      this.toast.show(
        metodoPago === 'tarjeta' ? 'Pago con tarjeta confirmado' : 'Mesa cobrada en efectivo',
        'success',
      );
    } catch (error) {
      console.error('Error al cobrar:', error);
      this.toast.show('Error al cobrar', 'error');
    }
  }
}
