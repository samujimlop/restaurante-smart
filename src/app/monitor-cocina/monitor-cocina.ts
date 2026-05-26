import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, query, onSnapshot, doc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-monitor-cocina',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './monitor-cocina.html'
})
export class MonitorCocinaComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private unsubscribe: any;

  comandasNuevas: any[] = [];
  comandasFuegos: any[] = [];
  comandasPase: any[] = [];

  ngOnInit() {
    const q = query(collection(this.firestore, 'comandas'));

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const hoy = new Date().toLocaleDateString();

      const todasBruto = snapshot.docs.map(d => {
        const data = d.data();
        const agrupados = new Map<string, any>();
        const itemsCrudos = data['items'] || [];

        itemsCrudos.forEach((item: any) => {
          // FILTRO BEBIDAS
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
              listos: estadoItem === 'listo' ? 1 : 0 
            });
          }
        });

        const itemsParaCocina = Array.from(agrupados.values());

        if (itemsParaCocina.length === 0) {
          return null; 
        }

        let fechaComanda = '';
        if (data['fecha']) {
          fechaComanda = typeof data['fecha'].toDate === 'function' 
            ? data['fecha'].toDate().toLocaleDateString() 
            : new Date(data['fecha']).toLocaleDateString();
        }

        // El "as any" le dice a TS que confíe en los datos de Firebase
        return {
          id: d.id,
          itemsOriginales: itemsCrudos,
          fechaFormateada: fechaComanda,
          ...data,
          itemsAgrupados: itemsParaCocina
        } as any; 
      });

      const todas = todasBruto.filter(c => c !== null);

      // Añadimos ": any" en las variables para que el compilador no se queje
      this.comandasFuegos = todas.filter((c: any) => c.estado?.toLowerCase().trim() === 'preparando');
      this.comandasPase = todas.filter((c: any) => c.estado?.toLowerCase().trim() === 'listo');

      this.comandasNuevas = todas.filter((c: any) => {
        const est = c.estado ? c.estado.toLowerCase().trim() : '';
        if (est !== 'recibido' && est !== 'nuevo') return false;
        if (c.fechaFormateada && c.fechaFormateada !== hoy) return false;
        return true;
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
      console.error("Error al actualizar estado general:", error);
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
      console.error("Error al tachar el plato:", error);
    }
  }
}