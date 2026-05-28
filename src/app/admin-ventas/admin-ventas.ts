import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot, query, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-ventas',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-ventas.html'
})
export class AdminVentasComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  // Control de interfaz
  modoVista: 'hoy' | 'historial' = 'hoy';

  // Formulario manual
  nuevoConcepto: string = '';
  nuevoMonto: number | null = null;
  nuevoTipo: 'Ingreso' | 'Gasto' = 'Ingreso';

  // Almacenes de datos divididos
  private operacionesManuales: any[] = [];
  private comandasPagadas: any[] = [];

  // Datos para la vista de HOY
  operacionesAnidadas: any[] = [];
  balanceTotal: number = 0;
  totalIngresos: number = 0;
  totalGastos: number = 0;

  // Datos para la vista de HISTORIAL
  historialAgrupado: any[] = [];

  cargandoIA: boolean = false;
  analisisIA: string = '';
  
  fechaHoyStr: string = new Date().toLocaleDateString();

  private unsubscribeManuales: any;
  private unsubscribeComandas: any;

  ngOnInit() {
    // 1. ESCUCHA 1: Movimientos manuales
    const qManuales = query(collection(this.firestore, 'operaciones_caja'));
    this.unsubscribeManuales = onSnapshot(qManuales, (snap) => {
      this.operacionesManuales = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        esComanda: false
      }));
      this.consolidarFlujoCaja();
    });

    // 2. ESCUCHA 2: Comandas cerradas desde el TPV
    const qComandas = query(collection(this.firestore, 'comandas'));
    this.unsubscribeComandas = onSnapshot(qComandas, (snap) => {
      this.comandasPagadas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((c: any) => c.estado === 'Pagada') 
        .map((c: any) => ({
          id: c.id,
          concepto: `Cierre Mesa ${c.numeroMesa} (TPV)`,
          monto: c.total || 0,
          tipo: 'Ingreso',
          fecha: c.fechaFinalizacion || c.fechaCreacion || null,
          esComanda: true
        }));
      this.consolidarFlujoCaja();
    });
  }

  ngOnDestroy() {
    if (this.unsubscribeManuales) this.unsubscribeManuales();
    if (this.unsubscribeComandas) this.unsubscribeComandas();
  }

  consolidarFlujoCaja() {
    const hoyString = new Date().toLocaleDateString();
    const todas = [...this.operacionesManuales, ...this.comandasPagadas];

    // --- 1. PROCESAMIENTO VISTA HOY ---
    const operacionesDeHoy = todas.filter(op => {
      const ms = this.obtenerMilisegundos(op.fecha);
      if (ms === 0) return false;
      return new Date(ms).toLocaleDateString() === hoyString;
    });

    this.operacionesAnidadas = operacionesDeHoy.sort((a, b) => {
      return this.obtenerMilisegundos(b.fecha) - this.obtenerMilisegundos(a.fecha);
    });

    this.totalIngresos = this.operacionesAnidadas.filter(o => o.tipo === 'Ingreso').reduce((acc, o) => acc + o.monto, 0);
    this.totalGastos = this.operacionesAnidadas.filter(o => o.tipo === 'Gasto').reduce((acc, o) => acc + o.monto, 0);
    this.balanceTotal = this.totalIngresos - this.totalGastos;

    // --- 2. PROCESAMIENTO VISTA HISTORIAL ---
    this.agruparHistorial(todas);

    this.cdr.detectChanges();
  }

  private agruparHistorial(todas: any[]) {
    const agrupado: any = {};

    todas.forEach(op => {
      const ms = this.obtenerMilisegundos(op.fecha);
      if (ms === 0) return;
      
      const date = new Date(ms);
      const ano = date.getFullYear().toString();
      const mesNum = date.getMonth(); 
      // Obtenemos el nombre del mes en español
      const mesNombre = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date);
      const mesKey = `${mesNum.toString().padStart(2, '0')}`; // Clave para ordenar meses

      if (!agrupado[ano]) agrupado[ano] = { ano, totalAno: 0, meses: {} };
      if (!agrupado[ano].meses[mesKey]) agrupado[ano].meses[mesKey] = {
        nombre: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
        mesIndex: mesNum,
        ingresos: 0,
        gastos: 0,
        balance: 0,
        operaciones: []
      };

      const mesRef = agrupado[ano].meses[mesKey];
      mesRef.operaciones.push(op);
      
      if (op.tipo === 'Ingreso') {
        mesRef.ingresos += op.monto;
        agrupado[ano].totalAno += op.monto;
      } else {
        mesRef.gastos += op.monto;
        agrupado[ano].totalAno -= op.monto;
      }
      mesRef.balance = mesRef.ingresos - mesRef.gastos;
    });

    // Convertimos el objeto en array ordenado descendente (2026, 2025...)
    this.historialAgrupado = Object.values(agrupado).sort((a: any, b: any) => b.ano.localeCompare(a.ano));
    
    // Ordenamos los meses internamente de Diciembre a Enero
    this.historialAgrupado.forEach(a => {
      a.mesesArr = Object.values(a.meses).sort((m1: any, m2: any) => m2.mesIndex - m1.mesIndex);
      // Ordenamos las operaciones por fecha dentro de cada mes
      a.mesesArr.forEach((m:any) => {
         m.operaciones.sort((o1:any, o2:any) => this.obtenerMilisegundos(o2.fecha) - this.obtenerMilisegundos(o1.fecha));
      });
    });
  }

  private obtenerMilisegundos(fechaField: any): number {
    if (!fechaField) return 0;
    if (fechaField.toDate) return fechaField.toDate().getTime(); 
    return new Date(fechaField).getTime(); 
  }

  async registrarOperacion() {
    if (!this.nuevoConcepto || !this.nuevoMonto || this.nuevoMonto <= 0) return;

    try {
      await addDoc(collection(this.firestore, 'operaciones_caja'), {
        concepto: this.nuevoConcepto,
        monto: this.nuevoMonto,
        tipo: this.nuevoTipo,
        fecha: new Date()
      });

      this.nuevoConcepto = '';
      this.nuevoMonto = null;
      this.nuevoTipo = 'Ingreso';
      // No hace falta detectChanges manual, Firestore lanzará el onSnapshot al guardar
    } catch (error) {
      console.error("Error al registrar operación manual:", error);
    }
  }

  generarAnalisisIA() {
    this.cargandoIA = true;
    this.analisisIA = '';
    this.cdr.detectChanges();

    setTimeout(() => {
      const ticketsHoy = this.operacionesAnidadas.filter(o => o.esComanda).length;
      this.analisisIA = `Análisis Diario: Caja consolidada. Se han detectado ${ticketsHoy} mesas cerradas hoy con un balance total neto de ${this.balanceTotal.toFixed(2)}€. La actividad muestra un rendimiento óptimo acorde a la capacidad de la sala.`;
      this.cargandoIA = false;
      this.cdr.detectChanges();
    }, 2000);
  }

  imprimirZ() {
    window.print();
  }
}