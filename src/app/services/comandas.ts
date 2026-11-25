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

export type MetodoPago = 'efectivo' | 'tarjeta';

/** Categorías que no pasan por cocina. */
const CATEGORIAS_BEBIDA = ['bebidas', 'bebida', 'refrescos'];

/** Estados en los que la comanda ya ha salido de cocina (columna "pase" o servida). */
const ESTADOS_FUERA_DE_COCINA = ['listo', 'entregado'];

/**
 * Bebida = su categoría es de bebidas. Solo se mira la categoría, nunca el nombre:
 * buscar "agua" o "vino" en el nombre confundía "Tostada de aguacate" o
 * "Solomillo al vino" con bebidas. Mismo criterio en sala y en cocina.
 */
export function esBebida(item: Pick<ItemComanda, 'categoria'>): boolean {
  return CATEGORIAS_BEBIDA.includes((item.categoria ?? '').toLowerCase().trim());
}

/** Platos de cocina que aún no están listos (las bebidas no cuentan). */
export function platosPendientes(items: ItemComanda[] | undefined): ItemComanda[] {
  return (items ?? []).filter((item) => !esBebida(item) && item.estado !== 'listo');
}

/**
 * Estado de la comanda tras añadirle un item. Si ya había salido de cocina
 * (listo o entregado) y el item es un plato, vuelve a la cola de cocina como
 * 'nuevo'; si no, se queda como está (devuelve null).
 */
export function estadoTrasAnadir(estadoActual: string | undefined, item: ItemComanda): string | null {
  const fuera = ESTADOS_FUERA_DE_COCINA.includes((estadoActual ?? '').toLowerCase().trim());
  return fuera && !esBebida(item) ? 'nuevo' : null;
}

/** Suma importes en céntimos (evita totales tipo 12.300000000000001). */
export function sumarEuros(importes: unknown[]): number {
  const centimos = importes.reduce<number>((acc, v) => acc + Math.round((Number(v) || 0) * 100), 0);
  return centimos / 100;
}

/** Total de una comanda. */
export function calcularTotal(items: ItemComanda[]): number {
  return sumarEuros(items.map((item) => item.price));
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
 * Cocina saca la comanda (a 'listo' o 'entregado'): marca como listos los
 * platos que cocina tenía en pantalla. Si entretanto un camarero ha añadido un
 * plato que cocina no ha visto, ese plato no se marca y la comanda vuelve a la
 * cola ('nuevo') en lugar de salir con él sin cocinar.
 */
export function sacarDeCocina(
  items: ItemComanda[],
  vistos: ItemComanda[],
  estadoDestino: string,
): { items: ItemComanda[]; estado: string } {
  const idsVistos = new Set(vistos.map((v) => v.id).filter(Boolean));
  const nombresVistosSinId = new Set(vistos.filter((v) => !v.id).map((v) => v.name));
  const visto = (item: ItemComanda) =>
    item.id ? idsVistos.has(item.id) : nombresVistosSinId.has(item.name);

  const resultado = items.map((item) =>
    !esBebida(item) && visto(item) ? { ...item, estado: 'listo' } : item,
  );
  return {
    items: resultado,
    estado: platosPendientes(resultado).length > 0 ? 'nuevo' : estadoDestino,
  };
}

/**
 * Modifica los items de una comanda dentro de una transacción.
 *
 * Sala y cocina editan el mismo array `items` a la vez. Si cada pantalla
 * escribiera su copia local, la última escritura borraría los cambios de la otra
 * (p. ej. un plato marcado "listo" volvería a "pendiente"). La transacción lee
 * los items actuales del servidor, aplica el cambio y, si alguien ha escrito
 * entretanto, Firestore la reintenta con los datos nuevos.
 *
 * `nuevoEstado` permite cambiar el estado de la comanda en la misma transacción
 * (devuelve null para dejarlo como está).
 */
export async function actualizarItems(
  firestore: Firestore,
  comandaId: string,
  cambio: (items: ItemComanda[]) => ItemComanda[],
  nuevoEstado?: (estadoActual: string | undefined) => string | null,
): Promise<{ items: ItemComanda[]; total: number; estado?: string }> {
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
    const estado = nuevoEstado?.(datos['estado']) ?? undefined;
    tx.update(ref, estado ? { items, total, estado } : { items, total });
    return { items, total, estado };
  });
}
