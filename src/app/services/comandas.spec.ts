import { ItemComanda, calcularTotal, quitarItem } from './comandas';

const item = (name: string, price: number, extra: Partial<ItemComanda> = {}): ItemComanda => ({
  name,
  price,
  estado: 'nuevo',
  categoria: 'Principales',
  ...extra,
});

describe('calcularTotal', () => {
  it('suma en céntimos sin errores de coma flotante', () => {
    expect(calcularTotal([item('a', 0.1), item('b', 0.2)])).toBe(0.3);
    expect(calcularTotal([item('a', 8.5), item('b', 3.5), item('c', 0.3)])).toBe(12.3);
  });

  it('devuelve 0 con la comanda vacía', () => {
    expect(calcularTotal([])).toBe(0);
  });
});

describe('quitarItem', () => {
  it('quita por id aunque la lista haya cambiado de orden', () => {
    const items = [item('Pizza', 11, { id: 'x' }), item('Pizza', 11, { id: 'y' })];
    expect(quitarItem([...items].reverse(), items[0]).map((i) => i.id)).toEqual(['y']);
  });

  it('no quita nada si el item ya no está (lo borró otro camarero)', () => {
    const items = [item('Pizza', 11, { id: 'y' })];
    expect(quitarItem(items, item('Pizza', 11, { id: 'x' }))).toEqual(items);
  });

  it('items antiguos sin id: quita solo uno que coincida en nombre, precio y estado', () => {
    const items = [item('Croquetas', 9, { estado: 'listo' }), item('Croquetas', 9), item('Croquetas', 9)];
    const resultado = quitarItem(items, item('Croquetas', 9));
    expect(resultado.length).toBe(2);
    expect(resultado[0].estado).toBe('listo');
  });
});
