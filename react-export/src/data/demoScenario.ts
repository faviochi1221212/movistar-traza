import type { AgentEvent } from '../types/agents';

/** Entidades reales del proyecto (verificadas contra Supabase durante esta
 * sesion), reutilizadas para que la narrativa de la demo sea consistente
 * con lo que Cliente 360 / Auditoria muestran si alguien lo busca despues:
 * CLIENT_00915, factura FHTP-00033372, S/ 55,718.00 (aciclica, aprobada y
 * emitida durante las pruebas E2E de esta misma sesion). */
export const DEMO_CLIENTE = 'CLIENT_00915';
export const DEMO_FACTURA = 'FHTP-00033372';
export const DEMO_MONTO = 'S/ 55,718';

export type DemoStep = Omit<AgentEvent, 'id' | 'timestamp'> & { delayMs: number };

export const CICLO_FACTURACION_PAGO: DemoStep[] = [
  { delayMs: 0, source: 'billing', type: 'source_loaded', title: 'Fuentes consolidadas', detail: '124 documentos de clientes, servicios, tarifas y periodos.', severity: 'normal' },
  { delayMs: 700, source: 'billing', type: 'validation_completed', title: 'Validación completada', detail: '116 correctos · 8 excepciones detectadas.', severity: 'normal' },
  { delayMs: 700, source: 'billing', type: 'exception_detected', entityId: DEMO_FACTURA, title: `Excepción en ${DEMO_FACTURA}`, detail: 'Requiere conformidad por monto elevado.', severity: 'warning' },
  { delayMs: 900, source: 'billing', type: 'conformity_requested', entityId: DEMO_FACTURA, title: 'Conformidad solicitada', detail: `${DEMO_CLIENTE} · correo enviado.`, severity: 'normal' },
  { delayMs: 900, source: 'billing', type: 'conformity_received', entityId: DEMO_FACTURA, title: 'Cliente aprobó', detail: 'Respuesta interpretada como conformidad.', severity: 'success' },
  { delayMs: 700, source: 'billing', type: 'invoice_issued', entityId: DEMO_FACTURA, title: `Factura emitida`, detail: `${DEMO_FACTURA} · ${DEMO_MONTO}`, severity: 'success' },
  { delayMs: 500, source: 'orchestrator', target: 'collections', type: 'handoff', entityId: DEMO_FACTURA, title: 'Transferencia operativa', detail: 'Nueva cuenta por cobrar enviada a Cobranzas.', severity: 'normal' },
  { delayMs: 800, source: 'collections', type: 'collection_strategy_created', entityId: DEMO_FACTURA, title: 'Estrategia creada', detail: 'Historial y riesgo consultados · recordatorio T-5.', severity: 'normal' },
  { delayMs: 900, source: 'collections', type: 'email_received', entityId: DEMO_FACTURA, title: 'Correo del cliente', detail: '"Adjunto constancia de transferencia".', severity: 'normal' },
  { delayMs: 700, source: 'collections', type: 'payment_detected', entityId: DEMO_FACTURA, title: 'Confirmación de pago', detail: `TRAZA interpretó el correo · ${DEMO_MONTO}.`, severity: 'success' },
  { delayMs: 700, source: 'collections', type: 'payment_matched', entityId: DEMO_FACTURA, title: 'Match encontrado', detail: `Movimiento bancario ↔ ${DEMO_FACTURA}.`, severity: 'success' },
  { delayMs: 600, source: 'orchestrator', target: 'revenue', type: 'handoff', entityId: DEMO_FACTURA, title: 'Conciliación transferida', detail: 'Cobranzas → Recaudo.', severity: 'normal' },
  { delayMs: 700, source: 'revenue', type: 'reconciliation_completed', entityId: DEMO_FACTURA, title: 'Pago aplicado', detail: `Saldo anterior ${DEMO_MONTO} → S/ 0.`, severity: 'success' },
  { delayMs: 600, source: 'orchestrator', target: 'bi', type: 'handoff', title: 'Resultado operacional', detail: 'Recaudo → BI.', severity: 'normal' },
  { delayMs: 700, source: 'bi', type: 'risk_updated', title: 'Riesgo recalculado', detail: `${DEMO_CLIENTE} actualizado.`, severity: 'normal' },
  { delayMs: 700, source: 'bi', type: 'pattern_detected', title: 'Patrón detectado', detail: '17 clientes concentran cartera vencida de alto riesgo.', severity: 'normal' },
  { delayMs: 600, source: 'bi', target: 'collections', type: 'strategy_recommended', title: 'Estrategia disponible', detail: 'Adelantar segundo contacto en cuentas similares.', severity: 'normal' },
];

export function buildEvents(steps: DemoStep[]): AgentEvent[] {
  const now = Date.now();
  let acc = 0;
  return steps.map((s, i) => {
    acc += s.delayMs;
    return { ...s, id: `demo-${i}`, timestamp: new Date(now + acc).toISOString() };
  });
}
