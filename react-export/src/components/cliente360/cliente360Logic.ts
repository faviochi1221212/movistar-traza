import { money, fecha, fechaHora } from '../../lib/api';

export type Factura = {
  id: string; numero: string; monto: number; fecha_emision: string; fecha_vencimiento: string;
  estado: string; tipo_factura: string; requiere_conformidad: boolean;
};
export type Comunicacion = {
  id: string; asunto: string; cuerpo: string; clasificacion: string | null; factura_id: string | null; recibido_at: string;
};
export type Caso = { id: string; asunto?: string; descripcion?: string | null; estado: string };
export type Resumen = {
  total_facturas: number; total_facturado: number; total_pagado: number; saldo_pendiente: number;
  casos_facturacion_abiertos: number; casos_cobranza_abiertos: number;
  probabilidad_pago: number | null; nivel_riesgo: string | null;
};
export type Detalle = {
  cliente: { id: string; razon_social: string; numero_identificacion_fiscal: string; segmento_pais: string | null; activo: boolean };
  resumen: Resumen | null;
  dias_promedio_pago: number | null;
  facturas: Factura[];
  casos_facturacion: Caso[];
  casos_cobranza: Caso[];
  comunicaciones: Comunicacion[];
};

const ESTADO_LABEL: Record<string, string> = {
  GENERADO: 'Generada', VALIDANDO: 'En validación', LISTO_EMISION: 'Lista para emitir',
  ESPERANDO_CONFORMIDAD: 'Esperando conformidad', APROBADO: 'Conformidad aprobada',
  OBSERVADO: 'Observada', SIN_RESPUESTA: 'Sin respuesta del cliente', EMITIDO: 'Emitida',
};
const CLASIF_LABEL: Record<string, string> = { RECLAMO: 'Reclamo', CONSULTA: 'Consulta', PROMESA_PAGO: 'Promesa de pago', CONFIRMACION_PAGO: 'Confirmación de pago', NOTA_CREDITO: 'Nota de crédito', OTRO: 'Otro' };

export function estadoLabel(e: string): string { return ESTADO_LABEL[e] || e; }
export function clasifLabel(c: string | null): string { return c ? CLASIF_LABEL[c] || c : 'Sin clasificar'; }

export function facturasPendientes(d: Detalle): Factura[] {
  return d.facturas.filter((f) => f.estado !== 'EMITIDO');
}

/** Cruza cada factura pendiente con comunicaciones reales asociadas (mismo
 * factura_id) para encontrar el "caso destacado": una factura con saldo
 * abierto sobre la que además hay un reclamo/consulta/promesa real. */
export function casoDestacado(d: Detalle): { factura: Factura; comunicacion: Comunicacion } | null {
  const pendientes = facturasPendientes(d);
  for (const f of pendientes) {
    const com = d.comunicaciones.find((c) => c.factura_id === f.id);
    if (com) return { factura: f, comunicacion: com };
  }
  return null;
}

export function situacionActual(d: Detalle): { texto: string; chips: string[] } {
  const caso = casoDestacado(d);
  if (caso) {
    const { factura, comunicacion } = caso;
    return {
      texto: `Existe una comunicación de tipo "${clasifLabel(comunicacion.clasificacion)}" relacionada con la factura ${factura.numero} (${money(factura.monto)}), que sigue en estado "${estadoLabel(factura.estado)}". Conviene validarla antes de continuar con nuevas gestiones de cobranza.`,
      chips: [clasifLabel(comunicacion.clasificacion), estadoLabel(factura.estado), factura.requiere_conformidad ? 'Requiere conformidad' : 'Sin conformidad requerida'],
    };
  }
  const pendientes = facturasPendientes(d);
  if (pendientes.length > 0 && d.resumen && d.resumen.saldo_pendiente > 0) {
    return {
      texto: `${pendientes.length} documento${pendientes.length === 1 ? '' : 's'} sigue${pendientes.length === 1 ? '' : 'n'} pendiente${pendientes.length === 1 ? '' : 's'} de emisión, con un saldo total de ${money(d.resumen.saldo_pendiente)}. No se detectaron reclamos ni consultas activas asociadas.`,
      chips: [`${pendientes.length} pendientes`, `Riesgo ${d.resumen.nivel_riesgo || 'sin evaluar'}`],
    };
  }
  return {
    texto: `El cliente no presenta documentos pendientes de emisión ni comunicaciones abiertas relacionadas con facturación en este momento.`,
    chips: ['Sin pendientes'],
  };
}

export function accionRecomendada(d: Detalle): { texto: string; categorias: string[] } {
  const caso = casoDestacado(d);
  if (caso) {
    return {
      texto: `Revisar la comunicación de ${d.cliente.razon_social} y resolver el estado de la factura ${caso.factura.numero} antes de continuar con la cobranza.`,
      categorias: ['FACTURA B2B', clasifLabel(caso.comunicacion.clasificacion).toUpperCase(), 'INSIGHT BI'],
    };
  }
  if (d.resumen?.nivel_riesgo === 'ALTO') {
    return { texto: `Priorizar el contacto con ${d.cliente.razon_social}: el modelo de riesgo lo clasifica como ALTO.`, categorias: ['RIESGO ML', 'COBRANZA'] };
  }
  return { texto: `No se identifican acciones urgentes sobre este cliente en este momento.`, categorias: ['SIN ACCIÓN URGENTE'] };
}

export type EventoTimeline = { timestamp: string; texto: string };

export function actividadReciente(d: Detalle): EventoTimeline[] {
  const eventos: EventoTimeline[] = [];
  d.comunicaciones.slice(0, 3).forEach((c) => eventos.push({ timestamp: c.recibido_at, texto: `${clasifLabel(c.clasificacion)}: ${c.asunto}` }));
  d.facturas.slice(0, 2).forEach((f) => eventos.push({ timestamp: f.fecha_emision, texto: `Factura ${f.numero} emitida por ${money(f.monto)} (${estadoLabel(f.estado)})` }));
  return eventos
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3);
}

export function eventoLabel(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  const esAyer = d.toDateString() === ayer.toDateString();
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (esHoy) return `Hoy ${hora}`;
  if (esAyer) return `Ayer ${hora}`;
  return `${fecha(iso)} ${hora}`;
}

// ---------------------------------------------------------------------------
// Motor de respuestas del Asistente Cliente 360
// ---------------------------------------------------------------------------

export function responderFacturasPendientes(d: Detalle): string {
  const pendientes = facturasPendientes(d);
  if (pendientes.length === 0) return `${d.cliente.razon_social} no tiene facturas pendientes registradas en este momento.`;
  const caso = casoDestacado(d);
  const lista = pendientes.map((f) => `${f.numero} por ${money(f.monto)} (${estadoLabel(f.estado)})`).join('; ');
  let texto = `Tiene ${pendientes.length} factura${pendientes.length === 1 ? '' : 's'} pendiente${pendientes.length === 1 ? '' : 's'}: ${lista}.`;
  if (caso) {
    texto += ` Desde Cobranza hay una comunicación de tipo "${clasifLabel(caso.comunicacion.clasificacion)}" asociada a ${caso.factura.numero}; conviene resolverla antes de insistir en el cobro.`;
  }
  return texto;
}

export function responderSeguirCobrando(d: Detalle): string {
  const caso = casoDestacado(d);
  if (caso && (caso.comunicacion.clasificacion === 'RECLAMO' || caso.comunicacion.clasificacion === 'CONFIRMACION_PAGO')) {
    return `No por ahora. Hay una comunicación de tipo "${clasifLabel(caso.comunicacion.clasificacion)}" sobre la factura ${caso.factura.numero} que aún no se resolvió. Recomiendo pausar recordatorios automáticos hasta validarla, para evitar una mala experiencia con el cliente.`;
  }
  if (d.resumen?.nivel_riesgo === 'BAJO' && (d.resumen?.saldo_pendiente || 0) < 1000) {
    return `El saldo pendiente es bajo (${money(d.resumen?.saldo_pendiente || 0)}) y el riesgo del cliente es BAJO. No es prioritario, pero puede mantenerse el seguimiento estándar.`;
  }
  return `Sí, no hay comunicaciones que sugieran pausar la cobranza. El saldo pendiente es ${money(d.resumen?.saldo_pendiente || 0)} con riesgo ${d.resumen?.nivel_riesgo || 'sin evaluar'}.`;
}

export function responderInsightBI(d: Detalle): string {
  const partes: string[] = [];
  if (d.dias_promedio_pago != null) {
    partes.push(`Este cliente paga en promedio ${d.dias_promedio_pago} días después de la emisión de la factura.`);
  }
  if (d.resumen?.probabilidad_pago != null) {
    partes.push(`El modelo estima ${(d.resumen.probabilidad_pago * 100).toFixed(0)}% de probabilidad de pago (riesgo ${d.resumen.nivel_riesgo}).`);
  }
  const caso = casoDestacado(d);
  if (caso) {
    partes.push(`El mayor riesgo actual no es mora real, sino una gestión de cobranza innecesaria mientras la comunicación sobre ${caso.factura.numero} sigue sin resolverse.`);
  }
  return partes.length > 0 ? partes.join(' ') : `No hay suficiente historial de pagos para generar un insight de comportamiento todavía.`;
}

export function responderRiesgoFuga(d: Detalle): string {
  const reclamos = d.comunicaciones.filter((c) => c.clasificacion === 'RECLAMO').length;
  if (reclamos > 0) {
    return `Hay ${reclamos} reclamo${reclamos === 1 ? '' : 's'} registrado${reclamos === 1 ? '' : 's'}. No es evidencia directa de fuga, pero conviene resolverlo pronto: los reclamos sin respuesta suelen preceder a caídas de facturación.`;
  }
  return `No se detectan reclamos ni señales de insatisfacción en las comunicaciones registradas. Riesgo de fuga bajo según la información disponible.`;
}

export function responderSaldoPendiente(d: Detalle): string {
  const r = d.resumen;
  if (!r) return 'No hay resumen financiero disponible para este cliente.';
  const caso = casoDestacado(d);
  let texto = `El saldo pendiente es ${money(r.saldo_pendiente)}, sobre un total facturado de ${money(r.total_facturado)} (${money(r.total_pagado)} ya pagado).`;
  if (caso) texto += ` Parte de ese saldo corresponde a la factura ${caso.factura.numero}, que tiene una comunicación de "${clasifLabel(caso.comunicacion.clasificacion)}" sin resolver.`;
  return texto;
}

export function responderRecomendacionCobranza(d: Detalle): string {
  return accionRecomendada(d).texto;
}

export function responderUltimosDias(d: Detalle): string {
  const eventos = actividadReciente(d);
  if (eventos.length === 0) return 'No hay actividad reciente registrada para este cliente.';
  return eventos.map((e) => `${eventoLabel(e.timestamp)}: ${e.texto}`).join(' · ');
}

export function responderResumenIntegral(d: Detalle): string {
  const r = d.resumen;
  if (!r) return 'No hay resumen disponible.';
  return `${d.cliente.razon_social} tiene ${r.total_facturas} facturas por ${money(r.total_facturado)} en total, con ${money(r.saldo_pendiente)} pendiente. Riesgo ${r.nivel_riesgo || 'sin evaluar'}, probabilidad de pago ${r.probabilidad_pago != null ? `${(r.probabilidad_pago * 100).toFixed(0)}%` : 'sin datos'}.`;
}

export type QuickPrompt = { texto: string; resolver: (d: Detalle) => string };

export const QUICK_PROMPTS: QuickPrompt[] = [
  { texto: 'Ver resumen integral', resolver: responderResumenIntegral },
  { texto: '¿Hay riesgo de fuga?', resolver: responderRiesgoFuga },
  { texto: 'Explica el saldo pendiente', resolver: responderSaldoPendiente },
  { texto: '¿Qué recomienda Cobranza?', resolver: responderRecomendacionCobranza },
  { texto: '¿Qué pasó en los últimos días?', resolver: responderUltimosDias },
  { texto: '¿Qué concluye BI?', resolver: responderInsightBI },
];

export function interpretarPreguntaLibre(pregunta: string, d: Detalle): string | null {
  const t = pregunta.toLowerCase();
  if (/facturas?\s+.*pendient/i.test(t)) return responderFacturasPendientes(d);
  if (/seguir\s+cobrando|debemos\s+cobrar/i.test(t)) return responderSeguirCobrando(d);
  if (/insight|bi\b|concluye/i.test(t)) return responderInsightBI(d);
  if (/fuga/i.test(t)) return responderRiesgoFuga(d);
  if (/saldo/i.test(t)) return responderSaldoPendiente(d);
  if (/cobranza.*recomien|recomien.*cobranza/i.test(t)) return responderRecomendacionCobranza(d);
  if (/[uú]ltimos?\s+d[ií]as|reciente/i.test(t)) return responderUltimosDias(d);
  if (/resumen\s+integral/i.test(t)) return responderResumenIntegral(d);
  return null;
}

export { fechaHora };
