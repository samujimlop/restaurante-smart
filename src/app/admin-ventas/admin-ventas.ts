import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot, query, addDoc, where } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { IaService } from '../services/ia.service';
import { ToastService } from '../services/toast.service';
import { sumarEuros } from '../services/comandas';

/** El historial abarca los últimos 12 meses: así no se descarga toda la vida del restaurante. */
const MESES_HISTORIAL = 12;

/** Cómo se muestra el método de pago; las comandas antiguas no lo tienen y salen como "TPV". */
const ETIQUETA_METODO: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta' };

@Component({
  selector: 'app-admin-ventas',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-ventas.html'
})
export class AdminVentasComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  readonly esGerente = inject(AuthService).esGerente;
  private ia = inject(IaService);
  private toast = inject(ToastService);

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
    const desde = new Date();
    desde.setMonth(desde.getMonth() - MESES_HISTORIAL);
    desde.setHours(0, 0, 0, 0);

    const qManuales = query(collection(this.firestore, 'operaciones_caja'), where('fecha', '>=', desde));
    this.unsubscribeManuales = onSnapshot(qManuales, (snap) => {
      this.operacionesManuales = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        esComanda: false
      }));
      this.consolidarFlujoCaja();
    });

    // 2. ESCUCHA 2: Comandas cerradas desde el TPV
    // Solo las comandas pagadas tienen fechaFinalizacion: este filtro descarta las abiertas y las antiguas.
    const qComandas = query(collection(this.firestore, 'comandas'), where('fechaFinalizacion', '>=', desde));
    this.unsubscribeComandas = onSnapshot(qComandas, (snap) => {
      this.comandasPagadas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((c: any) => c.estado === 'Pagada') 
        .map((c: any) => ({
          id: c.id,
          concepto: `Cierre Mesa ${c.numeroMesa} (${ETIQUETA_METODO[c.metodoPago] ?? 'TPV'})`,
          metodoPago: c.metodoPago ?? null,
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

    this.totalIngresos = sumarEuros(this.operacionesAnidadas.filter(o => o.tipo === 'Ingreso').map(o => o.monto));
    this.totalGastos = sumarEuros(this.operacionesAnidadas.filter(o => o.tipo === 'Gasto').map(o => o.monto));
    this.balanceTotal = sumarEuros([this.totalIngresos, -this.totalGastos]);

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
        mesRef.ingresos = sumarEuros([mesRef.ingresos, op.monto]);
        agrupado[ano].totalAno = sumarEuros([agrupado[ano].totalAno, op.monto]);
      } else {
        mesRef.gastos = sumarEuros([mesRef.gastos, op.monto]);
        agrupado[ano].totalAno = sumarEuros([agrupado[ano].totalAno, -op.monto]);
      }
      mesRef.balance = sumarEuros([mesRef.ingresos, -mesRef.gastos]);
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
    if (!this.esGerente()) return;
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
      this.toast.show('No se ha podido registrar el movimiento', 'error');
    }
  }

  /** Pide a Gemini un análisis de la caja de hoy comparada con los meses anteriores. */
  async generarAnalisisIA() {
    this.cargandoIA = true;
    this.analisisIA = '';
    this.cdr.detectChanges();

    const euros = (n: number) => `${n.toFixed(2)}€`;
    const movimientosHoy = this.operacionesAnidadas
      .map((o) => `- ${o.tipo}: ${o.concepto} (${euros(o.monto)})`)
      .join('\n');
    const meses = this.historialAgrupado
      .flatMap((a: any) => a.mesesArr.map((m: any) =>
        `- ${m.nombre} ${a.ano}: ingresos ${euros(m.ingresos)}, gastos ${euros(m.gastos)}, balance ${euros(m.balance)}`))
      .join('\n');

    const prompt = `Eres el asesor financiero de un restaurante.
      Caja de hoy (${this.fechaHoyStr}): ingresos ${euros(this.totalIngresos)}, gastos ${euros(this.totalGastos)}, balance ${euros(this.balanceTotal)}.
      Movimientos de hoy:
      ${movimientosHoy || '- (ninguno)'}

      Resumen de los últimos meses:
      ${meses || '- (sin datos)'}

      Redacta un análisis de máximo 4 líneas: cómo va el día frente a lo habitual, qué gasto o patrón destaca
      y una recomendación concreta. Usa solo los datos que te doy; si son pocos, dilo. Texto plano, sin saludos.`;

    try {
      this.analisisIA = await this.ia.generar(prompt);
    } catch (error) {
      console.error('Error con Gemini:', error);
      this.analisisIA = '❌ No se ha podido conectar con la IA. Inténtalo de nuevo en unos minutos.';
    } finally {
      this.cargandoIA = false;
      this.cdr.detectChanges();
    }
  }

  imprimirZ() {
    window.print();
  }
}