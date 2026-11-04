import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, query, onSnapshot, doc, updateDoc } from '@angular/fire/firestore';
import { IaService } from '../services/ia.service';

@Component({
  selector: 'app-monitor-cocina',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './monitor-cocina.html',
})
export class MonitorCocinaComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private ia = inject(IaService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private unsubscribe: any;

  comandasNuevas: any[] = [];
  comandasFuegos: any[] = [];
  comandasPase: any[] = [];

  // Variables para la IA
  cargandoIA: boolean = false;
  mostrarModalIA: boolean = false;
  respuestaIA: string = '';

  ngOnInit() {
    const q = query(collection(this.firestore, 'comandas'));

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const todasBruto = snapshot.docs.map((d) => {
        const data = d.data();
        const agrupados = new Map<string, any>();
        const itemsCrudos = data['items'] || [];

        itemsCrudos.forEach((item: any) => {
          const cat = item.categoria ? item.categoria.toLowerCase().trim() : '';
          if (cat === 'bebidas' || cat === 'bebida' || cat === 'refrescos') {
            return;
          }

          const estadoItem = item.estado || 'pendiente';

          if (agrupados.has(item.name)) {
            const plato = agrupados.get(item.name);
            plato.cantidad += 1;
            if (estadoItem === 'listo') plato.listos += 1;
          } else {
            agrupados.set(item.name, {
              name: item.name,
              cantidad: 1,
              listos: estadoItem === 'listo' ? 1 : 0,
            });
          }
        });

        const itemsParaCocina = Array.from(agrupados.values());

        if (itemsParaCocina.length === 0) {
          return null;
        }

        return {
          id: d.id,
          itemsOriginales: itemsCrudos,
          ...data,
          itemsAgrupados: itemsParaCocina,
        } as any;
      });

      const todas = todasBruto.filter((c) => c !== null);

      this.comandasFuegos = todas.filter(
        (c: any) => c.estado?.toLowerCase().trim() === 'preparando',
      );
      this.comandasPase = todas.filter((c: any) => c.estado?.toLowerCase().trim() === 'listo');

      this.comandasNuevas = todas.filter((c: any) => {
        const est = c.estado ? c.estado.toLowerCase().trim() : 'pendiente';
        return est === 'pendiente' || est === 'recibido' || est === 'nuevo';
      });

      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  async cambiarEstado(comandaId: string, nuevoEstado: string) {
    try {
      await updateDoc(doc(this.firestore, 'comandas', comandaId), { estado: nuevoEstado });
    } catch (error) {
      console.error('Error al actualizar estado general:', error);
    }
  }

  async tacharPlato(comanda: any, nombrePlato: string, completamenteTachado: boolean) {
    try {
      const nuevoEstado = completamenteTachado ? 'pendiente' : 'listo';

      const itemsActualizados = comanda.itemsOriginales.map((item: any) => {
        if (item.name === nombrePlato) {
          return { ...item, estado: nuevoEstado };
        }
        return item;
      });

      await updateDoc(doc(this.firestore, 'comandas', comanda.id), { items: itemsActualizados });
    } catch (error) {
      console.error('Error al tachar el plato:', error);
    }
  }

  // --- LÓGICA DE GEMINI INTEGRADA ---
  async optimizarLoteIA() {
    if (this.comandasNuevas.length === 0) {
      alert('No hay pedidos nuevos en cola para optimizar.');
      return;
    }

    this.cargandoIA = true;
    this.respuestaIA = '';
    this.cdr.detectChanges();

    try {
      const datosParaIA = this.comandasNuevas
        .map((c) => {
          return (
            `Mesa ${c.numeroMesa}: ` +
            c.itemsAgrupados.map((i: any) => `${i.cantidad}x ${i.name}`).join(', ')
          );
        })
        .join('\n');

      const prompt = `Eres el Jefe de Cocina experto del restaurante.
      Analiza estos pedidos pendientes en tiempo real:
      ${datosParaIA}
      
      Redacta un plan muy directo de cómo agrupar los platos para cocinarlos a la vez (ej: qué meter junto a la freidora, qué a la plancha).
      Usa viñetas cortas. Sé profesional. No saludes, ve al grano.`;

      this.respuestaIA = await this.ia.generar(prompt);
      this.mostrarModalIA = true;
    } catch (error) {
      console.error('Error con Gemini:', error);
      this.respuestaIA = '❌ Error al conectar con la Inteligencia Artificial.';
      this.mostrarModalIA = true;
    } finally {
      this.cargandoIA = false;
      this.cdr.detectChanges();
    }
  }
}
