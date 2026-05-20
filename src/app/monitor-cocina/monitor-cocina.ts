import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, doc, updateDoc, query, where } from '@angular/fire/firestore';

@Component({
  selector: 'app-monitor-cocina',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './monitor-cocina.html'
})
export class MonitorCocinaComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  comandasPendientes: any[] = [];
  comandasPreparando: any[] = [];
  comandasListas: any[] = [];

  analisisIA: string | null = null;
  pensandoIA: boolean = false;

  ngOnInit() {
    const q = query(collection(this.firestore, 'comandas'), where('estado', '==', 'Abierta'));
    
    onSnapshot(q, (snap) => {
      // Le decimos a TypeScript que esto es un array 'any' para evitar errores
      const todas: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      this.comandasPendientes = todas.filter((c: any) => !c.estadoCocina || c.estadoCocina === 'Pendiente');
      this.comandasPreparando = todas.filter((c: any) => c.estadoCocina === 'Preparando');
      this.comandasListas = todas.filter((c: any) => c.estadoCocina === 'Listo');
      
      this.cdr.detectChanges();
    });
  }

  async cambiarEstadoCocina(comandaId: string, nuevoEstado: string) {
    try {
      await updateDoc(doc(this.firestore, `comandas/${comandaId}`), {
        estadoCocina: nuevoEstado
      });
    } catch (error) {
      console.error("Error al mover comanda:", error);
    }
  }

  generarAnalisisIA() {
    this.pensandoIA = true;
    this.analisisIA = null;

    setTimeout(() => {
      const todosLosPlatos: any[] = [];
      
      [...this.comandasPendientes, ...this.comandasPreparando].forEach(comanda => {
        if (comanda.items) {
          todosLosPlatos.push(...comanda.items);
        }
      });

      if (todosLosPlatos.length === 0) {
        this.analisisIA = "La cocina está despejada. ¡Buen trabajo, equipo! Aprovechad para limpiar estaciones.";
        this.pensandoIA = false;
        return;
      }

      const conteoPlatos = todosLosPlatos.reduce((acc: any, plato: any) => {
        acc[plato.name] = (acc[plato.name] || 0) + 1;
        return acc;
      }, {});

      const platosOrdenados = Object.keys(conteoPlatos).sort((a, b) => conteoPlatos[b] - conteoPlatos[a]);
      
      const platoTop = platosOrdenados[0];
      const cantidadTop = conteoPlatos[platoTop];

      let mensaje = `🔥 ESTATEGIA ÓPTIMA DE PRODUCCIÓN:\n\n`;
      
      if (cantidadTop > 1) {
        mensaje += `⚡ ¡Alerta de lote! Tienes ${cantidadTop}x "${platoTop}" repartidos en varias mesas. Márchalos todos a la vez en la misma tanda.\n`;
      }

      const otrosPlatos = platosOrdenados.slice(1).map(p => `${conteoPlatos[p]}x ${p}`);
      if (otrosPlatos.length > 0) {
        mensaje += `\n🔪 Prepara también: ${otrosPlatos.join(', ')}.`;
      }

      this.analisisIA = mensaje;
      this.pensandoIA = false;
      this.cdr.detectChanges();
    }, 1500); 
  }
}