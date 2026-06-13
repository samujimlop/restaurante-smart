import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Firestore, collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, increment, getDocs
} from '@angular/fire/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Component({
  selector: 'app-smart-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './smart-inventory.html'
})
export class SmartInventory implements OnInit {
  private firestore: Firestore = inject(Firestore);
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
    salePrice: null as number | null
  };

  private yaSembrado = false;

  async ngOnInit() {
    const ref = collection(this.firestore, 'inventario');

    try {
      const primerCheck = await getDocs(ref);
      if (primerCheck.empty && !this.yaSembrado) {
        this.yaSembrado = true;
        const productosBase = [
          { name: 'Barril Cerveza Mahou', category: 'Bebidas', target: 10, unit: 'uds', purchasePrice: 50.00, salePrice: 150.00, stock: 2 },
          { name: 'Jamón Ibérico', category: 'Carnes', target: 5, unit: 'kg', purchasePrice: 45.00, salePrice: 120.00, stock: 4 },
          { name: 'Queso Manchego Curado', category: 'Lácteos', target: 8, unit: 'kg', purchasePrice: 14.50, salePrice: 40.00, stock: 1 },
          { name: 'Patatas Agrias (Bravas)', category: 'Vegetales', target: 50, unit: 'kg', purchasePrice: 0.80, salePrice: 6.50, stock: 45 },
          { name: 'Anillas de Calamar', category: 'Pescados', target: 15, unit: 'kg', purchasePrice: 9.20, salePrice: 28.00, stock: 12 },
          { name: 'Aceite de Oliva Virgen', category: 'Despensa', target: 20, unit: 'L', purchasePrice: 8.50, salePrice: 0, stock: 18 },
          { name: 'Pan Rústico (Hogaza)', category: 'Despensa', target: 40, unit: 'uds', purchasePrice: 0.90, salePrice: 2.50, stock: 5 },
          { name: 'Vino Tinto Rioja Crianza', category: 'Bebidas', target: 30, unit: 'uds', purchasePrice: 6.50, salePrice: 18.00, stock: 25 }
        ];

        for (const prod of productosBase) {
          await addDoc(ref, { ...prod, component: '' });
        }
      }
    } catch (error) { }

    onSnapshot(ref, (snapshot) => {
      const arrayTemporal: any[] = [];
      snapshot.forEach((documento) => {
        arrayTemporal.push({ id: documento.id, ...documento.data() });
      });
      
      this.listaProductos = arrayTemporal;
      this.productosCriticos = this.listaProductos.filter(p => p.stock < (p.target * 0.2));
      
      this.cdr.detectChanges();
    });
  }

  async sumarStock(item: any) {
    try {
      await updateDoc(doc(this.firestore, `inventario/${item.id}`), { stock: increment(1) });
      const coste = Number(item.purchasePrice) || 0;
      if (coste > 0) {
        await addDoc(collection(this.firestore, 'operaciones_caja'), {
          concepto: `Reposición almacén: ${item.name}`,
          monto: coste,
          tipo: 'Gasto',
          fecha: new Date(),
          esComanda: false
        });
      }
    } catch (error) { }
  }

  async restarStock(item: any) { 
    if (item.stock > 0) { 
      await updateDoc(doc(this.firestore, `inventario/${item.id}`), { stock: increment(-1) }); 
    } 
  }
  
  async borrar(id: string) { 
    if (confirm("¿Borrar?")) { 
      await deleteDoc(doc(this.firestore, `inventario/${id}`)); 
    } 
  }

  async generarAnalisisIA() {
    this.cargandoIA = true; 
    this.analisisIA = ''; 
    this.cdr.detectChanges();

    try {
      const genAI = new GoogleGenerativeAI('AQ.Ab8RN6K7WvnQKCxLujzdXoZT_0WEkZCeeKQgDakETY9vBxfb_w'); 
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const infoStock = this.listaProductos.map(p => 
        `- ${p.name}: Quedan ${p.stock} (El ideal es ${p.target})`
      ).join('\n');

      const prompt = `Eres el asistente inteligente de inventario de nuestro restaurante. 
      Analiza los siguientes datos de stock en tiempo real:
      ${infoStock}
      
      Redacta un informe muy breve, directo y profesional de máximo 3 líneas. 
      Indica claramente si hay estado crítico (si algún producto tiene menos del 20% de su ideal) y recomienda qué comprar, o felicita al equipo si el almacén está sano. No uses formatos raros, solo texto plano y algún emoji.`;

      const result = await model.generateContent(prompt);
      this.analisisIA = result.response.text();

    } catch (error) {
      console.error("Error de conexión con Gemini:", error);
      this.analisisIA = '❌ Error de red: Imposible conectar con el motor de inferencia. Comprueba la conexión.';
    } finally {
      this.cargandoIA = false; 
      this.cdr.detectChanges();
    }
  }

  abrir() { this.editandoId = null; this.resetearFormulario(); this.mostrarModal = true; }
  cerrar() { this.mostrarModal = false; }
  editar(item: any) {
    this.editandoId = item.id;
    this.nuevoProducto = { name: item.name, category: item.category || 'Vegetales', component: item.component || '', target: item.target || 100, unit: item.unit || 'kg', purchasePrice: item.purchasePrice || null, salePrice: item.salePrice || null };
    this.mostrarModal = true;
  }

  async guardarNuevo() {
    if (!this.nuevoProducto.name) return; this.cerrar();
    try {
      if (this.editandoId) {
        await updateDoc(doc(this.firestore, `inventario/${this.editandoId}`), { name: this.nuevoProducto.name, category: this.nuevoProducto.category, component: this.nuevoProducto.component, target: this.nuevoProducto.target, unit: this.nuevoProducto.unit, purchasePrice: this.nuevoProducto.purchasePrice || 0, salePrice: this.nuevoProducto.salePrice || 0 });
      } else {
        await addDoc(collection(this.firestore, 'inventario'), { name: this.nuevoProducto.name, category: this.nuevoProducto.category, component: this.nuevoProducto.component, target: this.nuevoProducto.target, unit: this.nuevoProducto.unit, purchasePrice: this.nuevoProducto.purchasePrice || 0, salePrice: this.nuevoProducto.salePrice || 0, stock: 0 });
      }
      this.resetearFormulario();
    } catch (e) { }
  }

  resetearFormulario() { this.nuevoProducto = { name: '', category: 'Vegetales', component: '', target: 100, unit: 'kg', purchasePrice: null, salePrice: null }; this.editandoId = null; }
  get productosFiltrados() {
  const termino = this.terminoBusqueda.toLowerCase().trim();
  if (!termino) {
    return this.listaProductos;
  }
  return this.listaProductos.filter(p =>
    p.name.toLowerCase().includes(termino) ||
    (p.category || '').toLowerCase().includes(termino)
  );
}

}