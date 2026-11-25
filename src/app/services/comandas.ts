import { Firestore, doc, runTransaction } from '@angular/fire/firestore';

export interface ItemComanda {
  /** Identificador del item dentro de la comanda (los items antiguos pueden no tenerlo). */
  id?: string;
  name: string;
  price: number;
  estado: string;
  categoria: string;
}

/** Estados que suponen cobrar la mesa: solo gerencia o quien tenga "cobrarMesas". */
export const ESTADOS_DE_COBRO = ['Aprobada_Para_Pago', 'Pagada'];

/** Suma los precios redondeando a céntimos (evita totales tipo 12.300000000000001). */
export function calcularTotal(items: ItemComanda[]): number {
  const centimos = items.reduce((acc, item) => acc + Math.round((Number(item.price) || 0) * 100), 0);
  return centimos / 100;
}

/**
 * Quita de la lista el item indicado. Si tiene id se busca por id; si no (items
 * creados antes de añadir ids), por nombre, precio y estado.
 */
export function quitarItem(items: ItemComanda[], objetivo: ItemComanda): ItemComanda[] {
  const indice = objetivo.id
    ? items.findIndex((i) => i.id === objetivo.id)
    : items.findIndex(
        (i) =>
          !i.id &&
          i.name === objetivo.name &&
          i.price === objetivo.price &&
          i.estado === objetivo.estado,
      );
  return indice === -1 ? items : items.filter((_, i) => i !== indice);
}

/**
 * Modifica los items de una comanda dentro de una transacción.
 *
 * Sala y cocina editan el mismo array `items` a la vez. Si cada pantalla
 * escribiera su copia local, la última escritura borraría los cambios de la otra
 * (p. ej. un plato marcado "listo" volvería a "pendiente"). La transacción lee
 * los items actuales del servidor, aplica el cambio y, si alguien ha escrito
 * entretanto, Firestore la reintenta con los datos nuevos.
 */
export async function actualizarItems(
  firestore: Firestore,
  comandaId: string,
  cambio: (items: ItemComanda[]) => ItemComanda[],
): Promise<{ items: ItemComanda[]; total: number }> {
  const ref = doc(firestore, 'comandas', comandaId);
  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('La comanda ya no existe');
    const datos = snap.data();
    const itemsServidor = Array.isArray(datos['items'])
      ? (datos['items'] as ItemComanda[])
      : [];
    const items = cambio(itemsServidor.map((item) => ({ ...item })));
    const total = calcularTotal(items);
    tx.update(ref, { items, total });
    return { items, total };
  });
}
