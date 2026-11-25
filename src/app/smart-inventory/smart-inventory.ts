import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Firestore,
  collection,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  increment,
  writeBatch,
} from '@angular/fire/firestore';
import { IaService } from '../services/ia.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-smart-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './smart-inventory.html',
})
export class SmartInventory implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private ia = inject(IaService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  listaProductos: any[] = [];
  productosCriticos: any[] = [];
  terminoBusqueda: string = '';

  mostrarModal = false;
  editandoId: string | null = null;

  cargandoIA: boolean = false;
  analisisIA: string = '';

  categorias = ['Vegetales', 'Carnes', 'Pescados', 'Lácteos', 'Bebidas', 'Despensa', 'Otros'];
  unidades = ['uds', 'kg', 'g', 'L', 'ml'];

  nuevoProducto = {
    name: '',
    category: 'Vegetales',
    component: '',
    target: 100,
    unit: 'kg',
    purchasePrice: null as number | null,
    salePrice: null as number | null,
  };

  async ngOnInit() {
    // (Antes, si el inventario estaba vacío se rellenaba solo con productos de
    // ejemplo. En producción eso mete datos falsos y puede duplicarlos si dos
    // personas abren la pantalla a la vez, así que se ha quitado.)
    this.destroyRef.onDestroy(
      onSnapshot(
        collection(this.firestore, 'inventario'),
        (snapshot) => {
          this.listaProductos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          this.productosCriticos = this.listaProductos.filter((p) => p.stock < p.target * 0.2);
          this.cdr.detectChanges();
        },
        (error) => {
          console.error('Error al cargar el inventario:', error);
          this.toast.show('No se ha podido cargar el inventario', 'error');
        },
      ),
    );
  }

  async sumarStock(item: any) {
    // Stock y gasto en un solo lote: o se guardan los dos o ninguno, y la caja cuadra.
    // itemId permite a las reglas comprobar que el importe es el precio de compra.
    const lote = writeBatch(this.firestore);
    lote.update(doc(this.firestore, `inventario/${item.id}`), { stock: increment(1) });
    const coste = Number(item.purchasePrice) || 0;
    if (coste > 0) {
      lote.set(doc(collection(this.firestore, 'operaciones_caja')), {
        concepto: `Reposición almacén: ${item.name}`,
        monto: item.purchasePrice,
        tipo: 'Gasto',
        fecha: new Date(),
        esComanda: false,
        itemId: item.id,
      });
    }
    try {
      await lote.commit();
    } catch (error) {
      console.error('Error al reponer stock:', error);
      this.toast.show('No se ha podido reponer el stock', 'error');
    }
  }

  async restarStock(item: any) {
    if (!(item.stock > 0)) return;
    try {
      await updateDoc(doc(this.firestore, `inventario/${item.id}`), { stock: increment(-1) });
    } catch (error) {
      console.error('Error al restar stock:', error);
      this.toast.show('No se ha podido actualizar el stock', 'error');
    }
  }

  async borrar(id: string) {
    if (!confirm('¿Borrar este producto del inventario?')) return;
    try {
      await deleteDoc(doc(this.firestore, `inventario/${id}`));
    } catch (error) {
      console.error('Error al borrar el producto:', error);
      this.toast.show('No se ha podido borrar el producto', 'error');
    }
  }

  async generarAnalisisIA() {
    this.cargandoIA = true;
    this.analisisIA = '';
    this.cdr.detectChanges();

    try {
      const infoStock = this.listaProductos
        .map((p) => `- ${p.name}: Quedan ${p.stock} (El ideal es ${p.target})`)
        .join('\n');

      const prompt = `Eres el asistente inteligente de inventario de nuestro restaurante. 
      Analiza los siguientes datos de stock en tiempo real:
      ${infoStock}
      
      Redacta un informe muy breve, directo y profesional de máximo 3 líneas. 
      Indica claramente si hay estado crítico (si algún producto tiene menos del 20% de su ideal) y recomienda qué comprar, o felicita al equipo si el almacén está sano. No uses formatos raros, solo texto plano y algún emoji.`;

      this.analisisIA = await this.ia.generar(prompt);
    } catch (error) {
      console.error('Error de conexión con Gemini:', error);
      this.analisisIA =
        '❌ Error de red: Imposible conectar con el motor de inferencia. Comprueba la conexión.';
    } finally {
      this.cargandoIA = false;
      this.cdr.detectChanges();
    }
  }

  abrir() {
    this.editandoId = null;
    this.resetearFormulario();
    this.mostrarModal = true;
  }
  cerrar() {
    this.mostrarModal = false;
  }
  editar(item: any) {
    this.editandoId = item.id;
    this.nuevoProducto = {
      name: item.name,
      category: item.category || 'Vegetales',
      component: item.component || '',
      target: item.target || 100,
      unit: item.unit || 'kg',
      purchasePrice: item.purchasePrice || null,
      salePrice: item.salePrice || null,
    };
    this.mostrarModal = true;
  }

  async guardarNuevo() {
    if (!this.nuevoProducto.name?.trim()) {
      this.toast.show('Escribe el nombre del producto', 'error');
      return;
    }
    try {
      if (this.editandoId) {
        await updateDoc(doc(this.firestore, `inventario/${this.editandoId}`), {
          name: this.nuevoProducto.name,
          category: this.nuevoProducto.category,
          component: this.nuevoProducto.component,
          target: this.nuevoProducto.target,
          unit: this.nuevoProducto.unit,
          purchasePrice: this.nuevoProducto.purchasePrice || 0,
          salePrice: this.nuevoProducto.salePrice || 0,
        });
      } else {
        await addDoc(collection(this.firestore, 'inventario'), {
          name: this.nuevoProducto.name,
          category: this.nuevoProducto.category,
          component: this.nuevoProducto.component,
          target: this.nuevoProducto.target,
          unit: this.nuevoProducto.unit,
          purchasePrice: this.nuevoProducto.purchasePrice || 0,
          salePrice: this.nuevoProducto.salePrice || 0,
          stock: 0,
        });
      }
      // Solo se cierra el formulario cuando se ha guardado de verdad.
      this.cerrar();
      this.resetearFormulario();
      this.toast.show('Producto guardado', 'success');
    } catch (error) {
      console.error('Error al guardar el producto:', error);
      this.toast.show('No se ha podido guardar. Revisa la conexión.', 'error');
    }
  }

  resetearFormulario() {
    this.nuevoProducto = {
      name: '',
      category: 'Vegetales',
      component: '',
      target: 100,
      unit: 'kg',
      purchasePrice: null,
      salePrice: null,
    };
    this.editandoId = null;
  }
  get productosFiltrados() {
    const termino = this.terminoBusqueda.toLowerCase().trim();
    if (!termino) {
      return this.listaProductos;
    }
    return this.listaProductos.filter(
      (p) =>
        p.name.toLowerCase().includes(termino) ||
        (p.category || '').toLowerCase().includes(termino),
    );
  }
}
