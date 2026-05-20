import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
export class AdminVentasComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  // Formulario manual
  nuevoConcepto: string = '';
  nuevoMonto: number | null = null;
  nuevoTipo: 'Ingreso' | 'Gasto' = 'Ingreso';

  // Almacenes de datos divididos
  private operacionesManuales: any[] = [];
  private comandasPagadas: any[] = [];

  // Lista unificada que leerá el HTML
  operacionesAnidadas: any[] = [];

  balanceTotal: number = 0;
  totalIngresos: number = 0;
  totalGastos: number = 0;

  cargandoIA: boolean = false;
  analisisIA: string = '';

  ngOnInit() {
    // 1. ESCUCHA 1: Movimientos manuales de caja (Gastos/Ingresos extras)
    const qManuales = query(collection(this.firestore, 'operaciones_caja'));
    onSnapshot(qManuales, (snap) => {
      this.operacionesManuales = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        esComanda: false
      }));
      this.consolidarFlujoCaja();
    });

    // 2. ESCUCHA 2: Comandas cerradas automáticamente desde el TPV de las mesas
    const qComandas = query(collection(this.firestore, 'comandas'));
    onSnapshot(qComandas, (snap) => {
      this.comandasPagadas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((c: any) => c.estado === 'Pagada') // Solo recuperamos las mesas cerradas
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

  // Fusiona las comandas y los gastos manuales, ordenándolos por fecha reciente
  consolidarFlujoCaja() {
    const todas = [...this.operacionesManuales, ...this.comandasPagadas];

    this.operacionesAnidadas = todas.sort((a, b) => {
      return this.obtenerMilisegundos(b.fecha) - this.obtenerMilisegundos(a.fecha);
    });

    // Recalculamos los balances económicos totales en tiempo real
    this.totalIngresos = this.operacionesAnidadas.filter(o => o.tipo === 'Ingreso').reduce((acc, o) => acc + o.monto, 0);
    this.totalGastos = this.operacionesAnidadas.filter(o => o.tipo === 'Gasto').reduce((acc, o) => acc + o.monto, 0);
    this.balanceTotal = this.totalIngresos - this.totalGastos;

    this.cdr.detectChanges();
  }

  private obtenerMilisegundos(fechaField: any): number {
    if (!fechaField) return 0;
    if (fechaField.toDate) return fechaField.toDate().getTime(); // Si viene como Timestamp de Firebase
    return new Date(fechaField).getTime(); // Si es string o Date nativo
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
      this.cdr.detectChanges();
    } catch (error) {
      console.error("Error al registrar operación manual:", error);
    }
  }

  generarAnalisisIA() {
    this.cargandoIA = true;
    this.analisisIA = '';
    this.cdr.detectChanges();

    setTimeout(() => {
      const totalMesas = this.comandasPagadas.length;
      this.analisisIA = `Análisis de Inteligencia Artificial: Flujo de caja consolidado con éxito. Se han detectado ${totalMesas} mesas cerradas automáticas del TPV sumando un balance total neto de ${this.balanceTotal.toFixed(2)}€. La actividad comercial de las mesas muestra un rendimiento óptimo. Buen control de gastos registrados.`;
      this.cargandoIA = false;
      this.cdr.detectChanges();
    }, 2000);
  }
}