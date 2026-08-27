import { money, fecha } from '../../lib/api';

export type Caso = {
  id: string; codigo: string; prioridad: string; cliente_nombre: string | null; factura_numero: string | null;
  factura_id: string | null; tipo_caso: string; asunto: string; descripcion: string | null;
  impacto_monto: number | null; estado: string; factura_fuente: string | null;
};
export type Validacion = {
  id: string; cliente_nombre: string | null; tipo_validacion: string; resultado: string;
  observacion: string | null; created_at: string; factura_id: string | null; factura_numero: string | null;
};
export type Emision = {
  id: string; numero: string; cliente_nombre: string | null; tipo_factura: string;
  estado: string; conformidad_estado: string; monto: number; puede_emitir: boolean; motivo: string; fuente: string | null;
};
export type Comunicacion = {
  id: string; cliente_nombre: string | null; factura_numero: string | null;
  clasificacion: string; asunto: string; recibido_at: string;
};
export type Resumen = {
  validacion: { correctas: number; en_revision: number; total: number };
  conformidad: { pendientes: number };
  emision: { emitidas: number; monto_emitido: number };
  control: { casos_abiertos: number; casos_criticos: number };
};

export type IntentContext = { resumen: Resumen | null; casos: Caso[]; validaciones: Validacion[]; emision: Emision[]; comunicaciones: Comunicacion[] };

export type RankingItem = { label: string; value: string; sub?: string };
export type ResultItem = Record<string, any>;
export type IntentResult = {
  titulo: string;
  bullets?: string[];
  ranking?: RankingItem[];
  filaTitulo?: string;
  filas?: ResultItem[];
  contexto?: { tipo: 'reclamos_consultas' | 'emision' | 'casos'; items: ResultItem[] };
  accion?: { label: string };
};

const TIPO_CASO_LABEL: Record<string, string> = {
  CLIENTE_ACTIVO: 'Cliente inactivo', MONEDA: 'Moneda inusual', MONTO_VALIDO: 'Monto inválido',
  PERIODO_COHERENTE: 'Periodo incoherente', CONSISTENCIA_ARITMETICA: 'Inconsistencia aritmética',
  SERVICIO_ACTIVO_SIN_FACTURACION: 'Servicio activo sin facturación',
};

const FUENTE_LABEL: Record<string, string> = {
  CSV_HISTORICO: 'Carga histórica (CSV)', LEGACY: 'Sistema legado', CORREO_CLIENTE: 'Correo del cliente', DEMO: 'Dataset demo',
  PLANTA_FIJA: 'Planta Fija', PLANTA_MOVIL: 'Planta Móvil', PLANTA_FIJA_Y_MOVIL: 'Planta Fija y Móvil',
};

/** CLIENT_00435, CLIENTE_DEMO_007, "cliente 435" -> "435" para comparar sin ceros/guiones. */
function extraerIdCliente(texto: string): string | null {
  const m = texto.match(/CLIENTE?[_ ]?(?:DEMO[_ ]?)?0*(\d+)/i);
  return m ? m[1] : null;
}
function clienteCoincide(razonSocial: string | null, idBuscado: string): boolean {
  if (!razonSocial) return false;
  const m = razonSocial.match(/0*(\d+)/);
  return !!m && m[1] === idBuscado;
}

function agrupar<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it) || 'Sin dato';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

const CLASIF_LABEL: Record<string, string> = { RECLAMO: 'Reclamo', CONSULTA: 'Consulta', NOTA_CREDITO: 'Nota de crédito' };

type Regla = { patron: RegExp; resolver: (texto: string, ctx: IntentContext) => IntentResult };

const REGLAS: Regla[] = [
  // 1. Conteo general de facturas / documentos
  {
    patron: /cu[aá]ntas?\s+facturas?\s+tenemos|cu[aá]ntos?\s+documentos?\s+(tenemos|hay)|facturas?\s+tenemos\s+actualmente/i,
    resolver: (_t, ctx) => {
      const r = ctx.resumen;
      if (!r) return { titulo: 'Aún no se cargó el resumen del ciclo.' };
      return {
        titulo: `Hay ${r.validacion.total} documentos en el ciclo de facturación actual.`,
        bullets: [
          `${r.validacion.correctas} validados correctamente`,
          `${r.validacion.en_revision} en revisión`,
          `${r.control.casos_abiertos} casos abiertos (${r.control.casos_criticos} críticos)`,
        ],
      };
    },
  },
  // 2. Listas vs bloqueadas
  {
    patron: /listas?\s+para\s+emitir|cu[aá]ntas?\s+(est[aá]n\s+)?bloqueada|listas\s+y.*bloqueada/i,
    resolver: (_t, ctx) => {
      const listas = ctx.emision.filter((e) => e.puede_emitir);
      const bloqueadas = ctx.emision.filter((e) => !e.puede_emitir);
      const montoListas = listas.reduce((s, e) => s + Number(e.monto), 0);
      const montoBloqueadas = bloqueadas.reduce((s, e) => s + Number(e.monto), 0);
      return {
        titulo: `${listas.length} documentos están listos para emitir y ${bloqueadas.length} están bloqueados.`,
        bullets: [
          `${money(montoListas)} listos para emitir`,
          `${money(montoBloqueadas)} bloqueados`,
        ],
        contexto: { tipo: 'emision', items: ctx.emision },
      };
    },
  },
  // 8/9. Granular por cliente: bloqueo, fuentes usadas, "qué ocurre con".
  // Va antes que las reglas agregadas (3/4) porque un ID de cliente explicito
  // es la senal mas fuerte de intencion granular, aunque la frase tambien
  // contenga palabras como "fuentes" o "problema".
  {
    patron: /qu[eé]\s+ocurre\s+con|por\s+qu[eé]\s+.*bloquead|muéstrame\s+las\s+facturas\s+de|validaciones\s+fallaron\s+para|[uú]ltima\s+factura\s+de|fuentes?\s+.*detectar\s+el\s+(problema|caso)\s+de|CLIENTE?[_ ]?\d+/i,
    resolver: (t, ctx) => {
      const id = extraerIdCliente(t);
      if (!id) return { titulo: 'No pude identificar el cliente en la pregunta.' };
      const emisionCliente = ctx.emision.filter((e) => clienteCoincide(e.cliente_nombre, id));
      const casosCliente = ctx.casos.filter((c) => clienteCoincide(c.cliente_nombre, id));
      const validacionesCliente = ctx.validaciones.filter((v) => clienteCoincide(v.cliente_nombre, id));
      const comsCliente = ctx.comunicaciones.filter((c) => clienteCoincide(c.cliente_nombre, id));
      const nombreCliente = emisionCliente[0]?.cliente_nombre || casosCliente[0]?.cliente_nombre || validacionesCliente[0]?.cliente_nombre || `cliente con ID ${id}`;

      if (emisionCliente.length === 0 && casosCliente.length === 0 && validacionesCliente.length === 0) {
        return { titulo: `No encontré documentos, validaciones o casos de ${nombreCliente} en el ciclo actual.` };
      }

      const fuentes = new Set<string>();
      casosCliente.forEach((c) => c.factura_fuente && fuentes.add(FUENTE_LABEL[c.factura_fuente] || c.factura_fuente));
      emisionCliente.forEach((e) => e.fuente && fuentes.add(FUENTE_LABEL[e.fuente] || e.fuente));

      const bullets: string[] = [];
      const bloqueada = emisionCliente.find((e) => !e.puede_emitir);
      if (bloqueada) bullets.push(`Bloqueada: ${bloqueada.numero} — ${money(bloqueada.monto)} — motivo: ${bloqueada.motivo}`);
      const lista = emisionCliente.find((e) => e.puede_emitir);
      if (lista) bullets.push(`Lista para emitir: ${lista.numero} — ${money(lista.monto)}`);
      if (casosCliente.length) bullets.push(`${casosCliente.length} caso(s): ${casosCliente.map((c) => TIPO_CASO_LABEL[c.tipo_caso] || c.tipo_caso).join(', ')}`);
      const fallidas = validacionesCliente.filter((v) => v.resultado !== 'CORRECTO');
      if (fallidas.length) bullets.push(`${fallidas.length} validación(es) con observación: ${fallidas.map((v) => v.tipo_validacion).join(', ')}`);
      if (fuentes.size) bullets.push(`Fuentes consultadas: ${Array.from(fuentes).join(', ')}`);
      comsCliente.forEach((c) => bullets.push(`${CLASIF_LABEL[c.clasificacion] || c.clasificacion}: ${c.asunto}${c.factura_numero ? ` (${c.factura_numero})` : ''}`));

      return { titulo: `${nombreCliente}`, bullets };
    },
  },
  // 3. Principales problemas (casos agrupados por tipo)
  {
    patron: /principales\s+problemas|motivos?\s+de\s+error|qu[eé]\s+est[aá]\s+fallando|problema\s+m[aá]s\s+recurrente/i,
    resolver: (_t, ctx) => {
      const activos = ctx.casos.filter((c) => c.estado !== 'DESCARTADO');
      const grupos = agrupar(activos, (c) => c.tipo_caso);
      const ranking = Array.from(grupos.entries())
        .map(([tipo, items]) => ({ label: TIPO_CASO_LABEL[tipo] || tipo, value: `${items.length} caso${items.length === 1 ? '' : 's'}`, sub: money(items.reduce((s, c) => s + Number(c.impacto_monto || 0), 0)) }))
        .sort((a, b) => parseInt(b.value) - parseInt(a.value));
      if (activos.length === 0) return { titulo: 'No hay casos abiertos actualmente en Facturación.' };
      return { titulo: `${activos.length} casos detectados en total.`, ranking: ranking.slice(0, 5), contexto: { tipo: 'casos', items: activos } };
    },
  },
  // 4. Fuentes con más incidencias
  {
    patron: /qu[eé]\s+fuentes?.*(incidencia|problema)|fuente\s+con\s+m[aá]s\s+inconsistencia|fuente.*concentra.*monto/i,
    resolver: (_t, ctx) => {
      const activos = ctx.casos.filter((c) => c.estado !== 'DESCARTADO');
      const grupos = agrupar(activos, (c) => c.factura_fuente);
      const ranking = Array.from(grupos.entries())
        .map(([fuente, items]) => ({ label: FUENTE_LABEL[fuente] || fuente, value: `${items.length} casos`, sub: money(items.reduce((s, c) => s + Number(c.impacto_monto || 0), 0)) }))
        .sort((a, b) => parseInt(b.value) - parseInt(a.value));
      if (ranking.length === 0) return { titulo: 'No hay casos con fuente identificada todavía.' };
      return {
        titulo: `La mayor concentración de incidencias proviene de ${ranking[0].label}.`,
        bullets: [`${ranking[0].value.split(' ')[0]} casos detectados`, `${ranking[0].sub} comprometidos`],
        ranking: ranking.slice(0, 5),
      };
    },
  },
  // 5. Reclamos / consultas de clientes
  {
    patron: /reclamos?\s+o\s+consultas|clientes?\s+tienen\s+reclamos|qui[eé]nes?\s+est[aá]n\s+consultando|facturas?\s+.*generado\s+consultas|documentos?\s+.*reclamos?\s+abiertos|motivo\s+de\s+consulta/i,
    resolver: (_t, ctx) => {
      if (ctx.comunicaciones.length === 0) return { titulo: 'No se detectaron comunicaciones de reclamo o consulta relacionadas con facturación por ahora.' };
      const reclamos = ctx.comunicaciones.filter((c) => c.clasificacion === 'RECLAMO');
      const consultas = ctx.comunicaciones.filter((c) => c.clasificacion === 'CONSULTA');
      const bullets: string[] = [];
      if (reclamos.length) bullets.push(`Reclamos · ${reclamos.length}`);
      reclamos.slice(0, 4).forEach((c) => bullets.push(`— ${c.cliente_nombre || '—'} (${c.factura_numero || 's/f'}) — ${c.asunto}`));
      if (consultas.length) bullets.push(`Consultas · ${consultas.length}`);
      consultas.slice(0, 4).forEach((c) => bullets.push(`— ${c.cliente_nombre || '—'} (${c.factura_numero || 's/f'}) — ${c.asunto}`));
      // Enriquecido con tipo_factura/monto de Emision (cuando la factura sigue
      // en proceso) para que el seguimiento conversacional pueda filtrar/ordenar.
      const enriquecidos: ResultItem[] = ctx.comunicaciones.map((c) => {
        const f = ctx.emision.find((e) => e.numero === c.factura_numero);
        return { ...c, tipo_factura: f?.tipo_factura, monto: f?.monto };
      });
      return {
        titulo: `Se detectaron ${ctx.comunicaciones.length} clientes con comunicaciones relacionadas con facturación.`,
        bullets,
        contexto: { tipo: 'reclamos_consultas', items: enriquecidos },
      };
    },
  },
  // 6. Clientes con más casos
  {
    patron: /clientes?\s+(tienen\s+)?m[aá]s\s+casos|qu[eé]\s+clientes?\s+concentran\s+m[aá]s\s+excepciones/i,
    resolver: (_t, ctx) => {
      const activos = ctx.casos.filter((c) => c.estado !== 'DESCARTADO');
      const grupos = agrupar(activos, (c) => c.cliente_nombre);
      const ranking = Array.from(grupos.entries())
        .map(([cliente, items]) => ({ label: cliente, value: `${items.length} caso${items.length === 1 ? '' : 's'}`, sub: money(items.reduce((s, c) => s + Number(c.impacto_monto || 0), 0)) }))
        .sort((a, b) => parseInt(b.value) - parseInt(a.value)).slice(0, 8);
      if (ranking.length === 0) return { titulo: 'No hay casos activos por cliente en este momento.' };
      return { titulo: `${ranking.length} clientes concentran los casos detectados.`, ranking };
    },
  },
  // 7. Acíclicas esperando conformidad
  {
    patron: /ac[ií]clicas?\s+.*conformidad|esperando\s+conformidad/i,
    resolver: (_t, ctx) => {
      const aciclicas = ctx.emision.filter((e) => e.tipo_factura === 'ACICLICA');
      const pendientes = aciclicas.filter((e) => e.conformidad_estado !== 'APROBADO');
      const monto = pendientes.reduce((s, e) => s + Number(e.monto), 0);
      return {
        titulo: `${pendientes.length} de ${aciclicas.length} facturas acíclicas siguen esperando conformidad.`,
        bullets: [`${money(monto)} en documentos pendientes de conformidad`],
        contexto: { tipo: 'emision', items: pendientes },
      };
    },
  },
  // 10. Mayor monto que no puede emitirse
  {
    patron: /mayor\s+monto\s+que\s+.*(no\s+pueden|todav[ií]a\s+no)|facturas\s+con\s+mayor\s+monto.*bloque/i,
    resolver: (_t, ctx) => {
      const bloqueadas = ctx.emision.filter((e) => !e.puede_emitir).sort((a, b) => b.monto - a.monto);
      if (bloqueadas.length === 0) return { titulo: 'No hay documentos bloqueados actualmente.' };
      return {
        titulo: `${bloqueadas.length} documentos bloqueados, ordenados de mayor a menor monto.`,
        ranking: bloqueadas.slice(0, 8).map((e) => ({ label: e.cliente_nombre || '—', value: money(e.monto), sub: e.motivo })),
        contexto: { tipo: 'emision', items: bloqueadas },
      };
    },
  },
];

const REFINAMIENTOS: { patron: RegExp; aplicar: (items: ResultItem[], tipo: string) => IntentResult | null }[] = [
  {
    patron: /solo\s+(los\s+|las\s+)?ac[ií]clic/i,
    aplicar: (items, tipo) => {
      const f = items.filter((i) => i.tipo_factura === 'ACICLICA');
      return {
        titulo: `${f.length} resultados acíclicos.`,
        bullets: f.slice(0, 8).map((i) => `${i.cliente_nombre || '—'}${i.factura_numero ? ` (${i.factura_numero})` : ''}${typeof i.monto === 'number' ? ` — ${money(i.monto)}` : ''}`),
        contexto: { tipo: tipo as any, items: f },
      };
    },
  },
  {
    patron: /solo\s+(los\s+|las\s+)?c[ií]clic/i,
    aplicar: (items, tipo) => {
      const f = items.filter((i) => i.tipo_factura === 'CICLICA');
      return {
        titulo: `${f.length} resultados cíclicos.`,
        bullets: f.slice(0, 8).map((i) => `${i.cliente_nombre || '—'}${i.factura_numero ? ` (${i.factura_numero})` : ''}${typeof i.monto === 'number' ? ` — ${money(i.monto)}` : ''}`),
        contexto: { tipo: tipo as any, items: f },
      };
    },
  },
  {
    patron: /mayor\s+monto|m[aá]s\s+alto/i,
    aplicar: (items) => {
      const conMonto = items.filter((i) => typeof i.monto === 'number');
      if (conMonto.length === 0) return { titulo: 'Los resultados anteriores no tienen monto asociado para comparar.' };
      const top = conMonto.sort((a, b) => b.monto - a.monto)[0];
      return { titulo: `${top.cliente_nombre || '—'} tiene el mayor monto: ${money(top.monto)}.` };
    },
  },
];

export function interpretarPreguntaFacturacion(pregunta: string, ctx: IntentContext, ultimoContexto: { tipo: string; items: ResultItem[] } | null): IntentResult | null {
  const t = pregunta.trim();
  for (const regla of REGLAS) {
    if (regla.patron.test(t)) return regla.resolver(t, ctx);
  }
  if (ultimoContexto) {
    for (const ref of REFINAMIENTOS) {
      if (ref.patron.test(t)) {
        const r = ref.aplicar(ultimoContexto.items, ultimoContexto.tipo);
        if (r) return r;
      }
    }
  }
  return null;
}

export function formatoFecha(iso: string): string {
  return fecha(iso);
}
