import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, query, onSnapshot, doc, updateDoc, where } from '@angular/fire/firestore';
import { ToastService } from '../services/toast.service';
import { IaService } from '../services/ia.service';
import { ItemComanda, actualizarItems, esBebida, sacarDeCocina } from '../services/comandas';

@Component({
  selector: 'app-monitor-cocina',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './monitor-cocina.html',
})
export class MonitorCocinaComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private ia = inject(IaService);
  private toast = inject(ToastService);
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
    // Solo las comandas que están en cocina (las tres columnas del monitor).
    const q = query(
      collection(this.firestore, 'comandas'),
      where('estado', 'in', ['nuevo', 'pendiente', 'recibido', 'preparando', 'listo']),
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const todasBruto = snapshot.docs.map((d) => {
        const data = d.data();
        const agrupados = new Map<string, any>();
        const itemsCrudos = data['items'] || [];

        itemsCrudos.forEach((item: any) => {
          if (esBebida(item)) return;

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
      if (nuevoEstado === 'listo' || nuevoEstado === 'entregado') {
        // Sacar la comanda de cocina = sus platos están hechos. Se marcan como
        // listos en la misma transacción (ver sacarDeCocina) para que sala pueda
        // cobrarla; solo los que cocina tenía en pantalla.
        const vistos: ItemComanda[] =
          [...this.comandasNuevas, ...this.comandasFuegos, ...this.comandasPase].find(
            (c) => c.id === comandaId,
          )?.itemsOriginales ?? [];
        let resultado: { items: ItemComanda[]; estado: string } | undefined;
        await actualizarItems(
          this.firestore,
          comandaId,
          (items) => (resultado = sacarDeCocina(items, vistos, nuevoEstado)).items,
          () => resultado?.estado ?? null,
        );
      } else {
        await updateDoc(doc(this.firestore, 'comandas', comandaId), { estado: nuevoEstado });
      }
    } catch (error) {
      console.error('Error al actualizar estado general:', error);
      this.toast.show('No se ha podido actualizar la comanda', 'error');
    }
  }

  async tacharPlato(comanda: any, nombrePlato: string, completamenteTachado: boolean) {
    try {
      const nuevoEstado = completamenteTachado ? 'pendiente' : 'listo';

      // En transacción: parte de los items actuales del servidor, no de la copia
      // en pantalla, para no borrar platos que un camarero acabe de añadir.
      await actualizarItems(this.firestore, comanda.id, (items) =>
        items.map((item) => (item.name === nombrePlato ? { ...item, estado: nuevoEstado } : item)),
      );
    } catch (error) {
      console.error('Error al tachar el plato:', error);
      this.toast.show('No se ha podido marcar el plato', 'error');
    }
  }

  // --- LÓGICA DE GEMINI INTEGRADA ---
  async optimizarLoteIA() {
    if (this.comandasNuevas.length === 0) {
      this.toast.show('No hay pedidos nuevos en cola para optimizar', 'info');
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
