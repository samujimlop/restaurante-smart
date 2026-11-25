import {
  ItemComanda,
  calcularTotal,
  esBebida,
  estadoTrasAnadir,
  platosPendientes,
  quitarItem,
  sacarDeCocina,
} from './comandas';

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

describe('esBebida', () => {
  it('decide por la categoría, sin importar mayúsculas ni espacios', () => {
    expect(esBebida(item('Agua mineral', 2, { categoria: ' Bebidas ' }))).toBe(true);
    expect(esBebida(item('Coca-Cola', 2.5, { categoria: 'refrescos' }))).toBe(true);
  });

  it('no confunde platos cuyo nombre contiene "agua" o "vino"', () => {
    expect(esBebida(item('Tostada de aguacate', 7, { categoria: 'Entrantes' }))).toBe(false);
    expect(esBebida(item('Solomillo al vino', 18, { categoria: 'Principales' }))).toBe(false);
  });

  it('un item sin categoría cuenta como plato (lo seguro es esperar a cocina)', () => {
    expect(esBebida(item('Sin categoría', 5, { categoria: undefined as unknown as string }))).toBe(false);
  });
});

describe('platosPendientes', () => {
  it('devuelve los platos que no están listos e ignora las bebidas', () => {
    const items = [
      item('Tostada de aguacate', 7, { categoria: 'Entrantes' }),
      item('Croquetas', 9, { estado: 'listo' }),
      item('Agua', 2, { categoria: 'Bebidas' }),
    ];
    expect(platosPendientes(items).map((i) => i.name)).toEqual(['Tostada de aguacate']);
  });

  it('acepta una comanda sin items', () => {
    expect(platosPendientes(undefined)).toEqual([]);
  });
});

describe('estadoTrasAnadir', () => {
  const postre = item('Tarta de queso', 6.5, { categoria: 'Postres' });
  const cafe = item('Café', 1.5, { categoria: 'Bebidas' });

  it('un plato pedido tras entregar devuelve la comanda a la cola de cocina', () => {
    expect(estadoTrasAnadir('entregado', postre)).toBe('nuevo');
    expect(estadoTrasAnadir('listo', postre)).toBe('nuevo');
  });

  it('una bebida no molesta a cocina', () => {
    expect(estadoTrasAnadir('entregado', cafe)).toBeNull();
  });

  it('si la comanda sigue en cocina, no cambia el estado', () => {
    expect(estadoTrasAnadir('preparando', postre)).toBeNull();
    expect(estadoTrasAnadir('nuevo', postre)).toBeNull();
    expect(estadoTrasAnadir(undefined, postre)).toBeNull();
  });
});

describe('sacarDeCocina', () => {
  const croquetas = item('Croquetas', 9, { id: 'a' });
  const agua = item('Agua', 2, { id: 'b', categoria: 'Bebidas' });

  it('marca como listos los platos que cocina tenía en pantalla', () => {
    const r = sacarDeCocina([croquetas, agua], [croquetas, agua], 'entregado');
    expect(r.estado).toBe('entregado');
    expect(r.items.map((i) => i.estado)).toEqual(['listo', 'nuevo']); // la bebida no se toca
  });

  it('si llega un plato que cocina no ha visto, no lo marca y la comanda vuelve a la cola', () => {
    const postre = item('Tarta de queso', 6.5, { id: 'c', categoria: 'Postres' });
    const r = sacarDeCocina([croquetas, postre], [croquetas], 'entregado');
    expect(r.estado).toBe('nuevo');
    expect(r.items.find((i) => i.id === 'c')?.estado).toBe('nuevo');
    expect(r.items.find((i) => i.id === 'a')?.estado).toBe('listo');
  });

  it('items antiguos sin id: se reconocen por el nombre', () => {
    const viejo = item('Bravas', 6);
    expect(sacarDeCocina([viejo], [viejo], 'listo').estado).toBe('listo');
  });
});
