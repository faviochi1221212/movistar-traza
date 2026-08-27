/** Motor de calculo generico y deterministico para los copilotos de TRAZA.
 * Interpreta periodo + operacion agregada (contar/sumar/promediar/top) sobre
 * cualquier arreglo de datos ya cargado en el frontend. Nunca genera cifras:
 * solo agrupa/suma/cuenta lo que ya existe en el dataset real. */

export type Periodo = { desde: Date; hasta: Date; etiqueta: string };

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

function ultimoDiaMes(anio: number, mes0: number): Date {
  return new Date(anio, mes0 + 1, 0, 23, 59, 59, 999);
}

/** "agosto", "agosto 2026", "este mes", "el mes pasado", "esta semana",
 * "este año", "hoy", "ayer", "últimos 30 días", "últimos 7 días". */
export function parsearPeriodo(texto: string, ahora: Date = new Date()): Periodo | null {
  const t = texto.toLowerCase();

  const mesConAnio = t.match(new RegExp(`(${MESES.join('|')})\\s*(?:de\\s*)?(\\d{4})?`, 'i'));
  if (mesConAnio) {
    let idx = MESES.indexOf(mesConAnio[1]);
    if (idx === 10) idx = 9; // "setiembre" == "septiembre"
    const anio = mesConAnio[2] ? Number(mesConAnio[2]) : ahora.getFullYear();
    const desde = new Date(anio, idx, 1, 0, 0, 0, 0);
    const hasta = ultimoDiaMes(anio, idx);
    return { desde, hasta, etiqueta: `${mesConAnio[1]} ${anio}` };
  }

  if (/este\s+mes|mes\s+actual/i.test(t)) {
    const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const hasta = ultimoDiaMes(ahora.getFullYear(), ahora.getMonth());
    return { desde, hasta, etiqueta: 'este mes' };
  }
  if (/mes\s+pasado|mes\s+anterior/i.test(t)) {
    const m = ahora.getMonth() - 1;
    const anio = m < 0 ? ahora.getFullYear() - 1 : ahora.getFullYear();
    const mes0 = (m + 12) % 12;
    return { desde: new Date(anio, mes0, 1), hasta: ultimoDiaMes(anio, mes0), etiqueta: 'el mes pasado' };
  }
  if (/este\s+a[nñ]o|a[nñ]o\s+actual/i.test(t)) {
    return { desde: new Date(ahora.getFullYear(), 0, 1), hasta: new Date(ahora.getFullYear(), 11, 31, 23, 59, 59), etiqueta: 'este año' };
  }
  if (/\bhoy\b/i.test(t)) {
    const d = new Date(ahora); d.setHours(0, 0, 0, 0);
    const h = new Date(ahora); h.setHours(23, 59, 59, 999);
    return { desde: d, hasta: h, etiqueta: 'hoy' };
  }
  if (/\bayer\b/i.test(t)) {
    const d = new Date(ahora); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
    const h = new Date(d); h.setHours(23, 59, 59, 999);
    return { desde: d, hasta: h, etiqueta: 'ayer' };
  }
  if (/esta\s+semana/i.test(t)) {
    const d = new Date(ahora); d.setDate(d.getDate() - 7);
    return { desde: d, hasta: ahora, etiqueta: 'esta semana' };
  }
  const ultimosNDias = t.match(/[uú]ltimos?\s+(\d+)\s*d[ií]as/i);
  if (ultimosNDias) {
    const n = Number(ultimosNDias[1]);
    const d = new Date(ahora); d.setDate(d.getDate() - n);
    return { desde: d, hasta: ahora, etiqueta: `últimos ${n} días` };
  }
  const ultimosNMeses = t.match(/[uú]ltimos?\s+(\d+)\s*mes/i);
  if (ultimosNMeses) {
    const n = Number(ultimosNMeses[1]);
    const d = new Date(ahora); d.setMonth(d.getMonth() - n);
    return { desde: d, hasta: ahora, etiqueta: `últimos ${n} meses` };
  }
  return null;
}

export function enRango(fechaIso: string | null | undefined, periodo: Periodo | null): boolean {
  if (!periodo) return true;
  if (!fechaIso) return false;
  const f = new Date(fechaIso).getTime();
  return f >= periodo.desde.getTime() && f <= periodo.hasta.getTime();
}

export type TipoOperacion = 'contar' | 'sumar' | 'promediar' | 'top' | 'maximo' | 'minimo';

export type Operacion = { tipo: TipoOperacion; n?: number };

/** Detecta que operacion aritmetica/agregada pide la pregunta. Reconoce
 * sumas, promedios (division), conteos y rankings top-N explicitamente. */
export function detectarOperacion(texto: string): Operacion {
  const t = texto.toLowerCase();
  const topMatch = t.match(/top\s*(\d+)|(\d+)\s+(?:clientes?|casos?|facturas?)\s+(?:m[aá]s|principales)|principales\s+(\d+)/i);
  if (topMatch) return { tipo: 'top', n: Number(topMatch[1] || topMatch[2] || topMatch[3] || 10) };
  if (/\bmayor\b|\bm[aá]s\s+alto\b|\bm[aá]ximo\b/i.test(t)) return { tipo: 'maximo' };
  if (/\bmenor\b|\bm[aá]s\s+bajo\b|\bm[ií]nimo\b/i.test(t)) return { tipo: 'minimo' };
  if (/promedio|en\s+promedio|media\s+de|divid/i.test(t)) return { tipo: 'promediar' };
  if (/suma|total\s+de|monto\s+total|cu[aá]nto\s+(se\s+)?(factur|cobr|pag)|cu[aá]nto\s+suman/i.test(t)) return { tipo: 'sumar' };
  return { tipo: 'contar' };
}

export function sumar(items: number[]): number {
  return items.reduce((s, v) => s + (Number(v) || 0), 0);
}
export function promedio(items: number[]): number {
  return items.length > 0 ? sumar(items) / items.length : 0;
}

export type GrupoResultado = { clave: string; cantidad: number; total: number };

/** Agrupa items por una clave (ej. cliente) y calcula cantidad + suma de un
 * campo numerico para cada grupo; ordena de mayor a menor total. */
export function agruparYSumar<T>(items: T[], clave: (i: T) => string, valor: (i: T) => number): GrupoResultado[] {
  const mapa = new Map<string, { cantidad: number; total: number }>();
  for (const it of items) {
    const k = clave(it) || 'Sin dato';
    const actual = mapa.get(k) || { cantidad: 0, total: 0 };
    actual.cantidad += 1;
    actual.total += Number(valor(it)) || 0;
    mapa.set(k, actual);
  }
  return Array.from(mapa.entries())
    .map(([clave, v]) => ({ clave, ...v }))
    .sort((a, b) => b.total - a.total);
}
