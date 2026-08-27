import { useState } from 'react';
import { colors } from '../../lib/styles';
import { api, money, fecha } from '../../lib/api';
import BIResultTable, { riesgoBadge, type ResultTableSpec } from './BIResultTable';
import type { ChartSpec } from './charts';
import { detectarOperacion, sumar, promedio, agruparYSumar } from '../../lib/queryEngine';

type CarteraRow = { factura_id: string; numero?: string; cliente_id: string; razon_social: string; saldo_pendiente: number; fecha_vencimiento: string; dias_vencidos: number; aging: string };
type RiesgoCliente = { cliente_id: string; razon_social: string; probabilidad_pago: number; nivel_riesgo: string; saldo_pendiente: number; dias_vencidos: number };
type Oportunidad = { cliente_id: string; razon_social: string; saldo_pendiente: number; dias_vencidos: number; prioridad: string; oportunidad: string; accion_sugerida: string; probabilidad_pago: number; nivel_riesgo: string };
type TendenciaMes = { mes: string; monto_facturado: number; monto_cobrado: number; ratio_cobrado_facturado: number };

type Msg = {
  role: 'user' | 'ai'; text: string; timestamp: string;
  tabla?: ResultTableSpec; barSpec?: ChartSpec; lineSpec?: ChartSpec;
};
type ActividadItem = { hora: string; texto: string };

function horaAhora(): string {
  return new Date().toLocaleTimeString('es-PE', { hour12: false });
}

function mesLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
}

export default function BICopilot({
  cartera, riesgo, oportunidades, tendencia, onAplicarBar, onAplicarLine,
}: {
  cartera: CarteraRow[]; riesgo: RiesgoCliente[]; oportunidades: Oportunidad[]; tendencia: TendenciaMes[];
  onAplicarBar: (spec: ChartSpec) => void; onAplicarLine: (spec: ChartSpec) => void;
}) {
  const [tab, setTab] = useState<'copiloto' | 'actividad'>('copiloto');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actividad, setActividad] = useState<ActividadItem[]>([]);

  const log = (texto: string) => setActividad((a) => [...a, { hora: horaAhora(), texto }]);

  const interpretar = (q: string): Msg | null => {
    const texto = q.toLowerCase();

    // Pregunta 1: ranking de clientes con mayor deuda vencida + concentracion
    if (/mayor\s+deuda\s+vencida|deuda\s+vencida.*concentr/i.test(texto)) {
      log('Consultando cartera');
      const vencida = cartera.filter((c) => c.dias_vencidos > 0);
      const porCliente = new Map<string, { razon_social: string; saldo: number }>();
      vencida.forEach((c) => {
        const cur = porCliente.get(c.cliente_id) || { razon_social: c.razon_social, saldo: 0 };
        cur.saldo += Number(c.saldo_pendiente);
        porCliente.set(c.cliente_id, cur);
      });
      const totalVencido = vencida.reduce((s, c) => s + Number(c.saldo_pendiente), 0);
      const nMatch = texto.match(/(\d+)\s+clientes/);
      const n = nMatch ? Number(nMatch[1]) : 10;
      const top = Array.from(porCliente.entries()).map(([id, v]) => ({ cliente_id: id, ...v }))
        .sort((a, b) => b.saldo - a.saldo).slice(0, n);
      const concentracion = totalVencido > 0 ? top.reduce((s, t) => s + t.saldo, 0) / totalVencido : 0;
      log('Agrupando datos');
      log('Respuesta generada');
      return {
        role: 'ai', timestamp: horaAhora(),
        text: `Los ${top.length} clientes con mayor deuda vencida concentran ${money(top.reduce((s, t) => s + t.saldo, 0))} (${(concentracion * 100).toFixed(0)}% de la cartera vencida total).`,
        tabla: {
          csvNombre: 'clientes_mayor_deuda_vencida',
          columns: [
            { key: 'razon_social', label: 'Cliente' },
            { key: 'saldo', label: 'Monto vencido', align: 'right', render: (r) => money(r.saldo) },
            { key: 'concentracion', label: '% cartera', align: 'right', render: (r) => `${((r.saldo / (totalVencido || 1)) * 100).toFixed(1)}%` },
            { key: 'riesgo', label: 'Riesgo', render: (r) => { const rr = riesgo.find((x) => x.cliente_id === r.cliente_id); const b = riesgoBadge(rr?.nivel_riesgo); return <span style={{ fontSize: 10.5, fontWeight: 600, color: b.fg, background: b.bg, borderRadius: 5, padding: '2px 6px' }}>{b.label}</span>; } },
          ],
          rows: top,
        },
        barSpec: { type: 'bar', title: `Top ${top.length} clientes por deuda vencida`, subtitle: 'Generado por el copiloto', format: 'money', data: top.map((t) => ({ label: t.razon_social, value: t.saldo })) },
      };
    }

    // Pregunta 2: facturas que vencen en los proximos N dias
    const venceMatch = texto.match(/vencen?\s+en\s+los?\s+pr[oó]ximos?\s+(\d+)\s*d[ií]as|pr[oó]ximos?\s+(\d+)\s*d[ií]as/);
    if (venceMatch && /factur/.test(texto)) {
      const dias = Number(venceMatch[1] || venceMatch[2] || 7);
      log('Consultando cartera');
      const hoy = new Date();
      const limite = new Date(hoy); limite.setDate(hoy.getDate() + dias);
      const filas = cartera.filter((c) => {
        const fv = new Date(c.fecha_vencimiento);
        return fv >= hoy && fv <= limite;
      }).sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
      const montoTotal = filas.reduce((s, f) => s + Number(f.saldo_pendiente), 0);
      log('Ordenando por monto');
      log('Respuesta generada');
      return {
        role: 'ai', timestamp: horaAhora(),
        text: filas.length > 0
          ? `Encontré ${filas.length} facturas por ${money(montoTotal)} que vencen en los próximos ${dias} días, ordenadas de mayor a menor monto.`
          : `No encontré facturas que venzan en los próximos ${dias} días.`,
        tabla: filas.length > 0 ? {
          csvNombre: 'facturas_por_vencer',
          columns: [
            { key: 'razon_social', label: 'Cliente' },
            { key: 'numero', label: 'Factura' },
            { key: 'fecha_vencimiento', label: 'Vence', render: (r) => fecha(r.fecha_vencimiento) },
            { key: 'saldo_pendiente', label: 'Monto', align: 'right', render: (r) => money(r.saldo_pendiente) },
            { key: 'riesgo', label: 'Riesgo', render: (r) => { const rr = riesgo.find((x) => x.cliente_id === r.cliente_id); const b = riesgoBadge(rr?.nivel_riesgo); return <span style={{ fontSize: 10.5, fontWeight: 600, color: b.fg, background: b.bg, borderRadius: 5, padding: '2px 6px' }}>{b.label}</span>; } },
          ],
          rows: filas,
        } : undefined,
      };
    }

    // Pregunta 3: alta probabilidad de no pagar + saldo minimo
    if (/probabilidad.*no\s+pagar|no\s+pagar.*probabilidad/i.test(texto)) {
      log('Consultando modelo de riesgo');
      const montoMatch = texto.match(/s\/?\s?([\d.,]+)/i);
      const minimo = montoMatch ? Number(montoMatch[1].replace(/,/g, '')) : 50000;
      const filas = riesgo.filter((r) => r.nivel_riesgo === 'ALTO' && r.saldo_pendiente > minimo)
        .sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
      log('Cruzando con saldo pendiente');
      log('Respuesta generada');
      return {
        role: 'ai', timestamp: horaAhora(),
        text: filas.length > 0
          ? `${filas.length} clientes tienen riesgo alto de impago y más de ${money(minimo)} pendientes, por un total de ${money(filas.reduce((s, f) => s + Number(f.saldo_pendiente), 0))}.`
          : `No encontré clientes de riesgo alto con más de ${money(minimo)} pendientes.`,
        tabla: filas.length > 0 ? {
          csvNombre: 'riesgo_alto_saldo_alto',
          columns: [
            { key: 'razon_social', label: 'Cliente' },
            { key: 'probabilidad_pago', label: 'Prob. pago', align: 'right', render: (r) => `${(r.probabilidad_pago * 100).toFixed(1)}%` },
            { key: 'nivel_riesgo', label: 'Riesgo', render: (r) => { const b = riesgoBadge(r.nivel_riesgo); return <span style={{ fontSize: 10.5, fontWeight: 600, color: b.fg, background: b.bg, borderRadius: 5, padding: '2px 6px' }}>{b.label}</span>; } },
            { key: 'saldo_pendiente', label: 'Saldo', align: 'right', render: (r) => money(r.saldo_pendiente) },
          ],
          rows: filas,
        } : undefined,
      };
    }

    // Pregunta 4: evolucion ratio cobrado/facturado
    if (/ratio\s+cobrado.*facturado|cobrado\s+sobre\s+facturado|evoluci[oó]n.*cobrad/i.test(texto)) {
      log('Consultando tendencia de cobranza');
      const spec: ChartSpec = {
        type: 'line', title: 'Evolución cobrado / facturado', subtitle: 'Últimos 6 meses · aplicado por el copiloto',
        format: 'percent', data: tendencia.map((m) => ({ label: mesLabel(m.mes), value: m.ratio_cobrado_facturado })),
      };
      const primero = tendencia[0]?.ratio_cobrado_facturado ?? 0;
      const ultimo = tendencia[tendencia.length - 1]?.ratio_cobrado_facturado ?? 0;
      const delta = (ultimo - primero) * 100;
      log('Generando gráfico');
      log('Respuesta generada');
      return {
        role: 'ai', timestamp: horaAhora(),
        text: `El ratio cobrado/facturado ${delta >= 0 ? 'mejoró' : 'cayó'} ${Math.abs(delta).toFixed(1)} puntos porcentuales en los últimos ${tendencia.length} meses, cerrando en ${(ultimo * 100).toFixed(1)}%.`,
        lineSpec: spec,
      };
    }

    // Pregunta 5: mayor oportunidad de recupero
    if (/oportunidad\s+de\s+recupero|recupero.*priorizar|priorizar.*recupero/i.test(texto)) {
      log('Consultando oportunidades de recupero');
      const altas = oportunidades.filter((o) => o.prioridad === 'Alta').sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
      const monto = altas.reduce((s, o) => s + Number(o.saldo_pendiente), 0);
      log('Cruzando aging, riesgo y comportamiento histórico');
      log('Respuesta generada');
      return {
        role: 'ai', timestamp: horaAhora(),
        text: altas.length > 0
          ? `La mayor oportunidad inmediata está en ${altas.length} clientes de prioridad alta (deuda vencida, riesgo evaluado y probabilidad de recuperación). Se identificaron ${altas.length} clientes por ${money(monto)}.`
          : 'No se identificaron oportunidades de prioridad alta en este momento.',
        tabla: altas.length > 0 ? {
          csvNombre: 'oportunidades_recupero',
          columns: [
            { key: 'razon_social', label: 'Cliente' },
            { key: 'oportunidad', label: 'Oportunidad' },
            { key: 'saldo_pendiente', label: 'Saldo', align: 'right', render: (r) => money(r.saldo_pendiente) },
            { key: 'accion_sugerida', label: 'Acción sugerida' },
          ],
          rows: altas,
        } : undefined,
      };
    }

    // Fallback generico: top-N / contar / sumar / promediar sobre cartera y
    // riesgo cuando ninguna de las 5 preguntas de demo coincide exactamente.
    const operacion = detectarOperacion(texto);
    if (/cr[ií]tico|prioriz|mayor riesgo|peor(es)?\s+client/i.test(texto)) {
      log('Cruzando riesgo y saldo pendiente');
      const porRiesgo = new Map(riesgo.map((r) => [r.cliente_id, r]));
      const orden = { ALTO: 0, MEDIO: 1, BAJO: 2 } as Record<string, number>;
      const criticos = [...cartera]
        .reduce((acc: Map<string, number>, c) => acc.set(c.cliente_id, (acc.get(c.cliente_id) || 0) + Number(c.saldo_pendiente)), new Map<string, number>());
      const lista = Array.from(criticos.entries()).map(([cliente_id, saldo]) => {
        const r = porRiesgo.get(cliente_id);
        return { cliente_id, razon_social: r?.razon_social || cartera.find((c) => c.cliente_id === cliente_id)?.razon_social || '—', saldo, nivel: r?.nivel_riesgo || 'SIN_EVALUAR' };
      }).sort((a, b) => (orden[a.nivel] ?? 3) - (orden[b.nivel] ?? 3) || b.saldo - a.saldo);
      const n = operacion.tipo === 'top' ? operacion.n! : 10;
      log('Respuesta generada');
      return {
        role: 'ai', timestamp: horaAhora(),
        text: `Los ${n} clientes más críticos combinan mayor riesgo y mayor saldo pendiente.`,
        tabla: {
          csvNombre: 'clientes_criticos',
          columns: [
            { key: 'razon_social', label: 'Cliente' },
            { key: 'nivel', label: 'Riesgo', render: (r) => { const b = riesgoBadge(r.nivel); return <span style={{ fontSize: 10.5, fontWeight: 600, color: b.fg, background: b.bg, borderRadius: 5, padding: '2px 6px' }}>{b.label}</span>; } },
            { key: 'saldo', label: 'Saldo pendiente', align: 'right', render: (r) => money(r.saldo) },
          ],
          rows: lista.slice(0, n),
        },
      };
    }
    if (operacion.tipo === 'sumar' && /cartera|pendiente|deuda/i.test(texto)) {
      log('Sumando cartera pendiente');
      const total = sumar(cartera.map((c) => c.saldo_pendiente));
      log('Respuesta generada');
      return { role: 'ai', timestamp: horaAhora(), text: `La cartera pendiente total es ${money(total)} en ${cartera.length} documentos.` };
    }
    if (operacion.tipo === 'promediar' && /cartera|pendiente|deuda|saldo/i.test(texto)) {
      log('Calculando promedio');
      const prom = promedio(cartera.map((c) => c.saldo_pendiente));
      log('Respuesta generada');
      return { role: 'ai', timestamp: horaAhora(), text: `El saldo pendiente promedio por factura es ${money(prom)}, sobre ${cartera.length} documentos.` };
    }
    if (operacion.tipo === 'top' && /client/i.test(texto)) {
      log('Agrupando por cliente');
      const grupos = agruparYSumar(cartera, (c) => c.razon_social, (c) => c.saldo_pendiente);
      log('Respuesta generada');
      return {
        role: 'ai', timestamp: horaAhora(),
        text: `Top ${operacion.n} clientes por saldo pendiente.`,
        tabla: {
          csvNombre: 'top_clientes_saldo',
          columns: [
            { key: 'clave', label: 'Cliente' },
            { key: 'cantidad', label: 'Facturas', align: 'right' },
            { key: 'total', label: 'Saldo', align: 'right', render: (r) => money(r.total) },
          ],
          rows: grupos.slice(0, operacion.n),
        },
      };
    }

    return null;
  };

  const enviar = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const ts = horaAhora();
    setMsgs((m) => [...m, { role: 'user', text: q, timestamp: ts }]);
    setInput('');
    setLoading(true);
    log('Interpretando consulta');

    try {
      const especial = interpretar(q);
      if (especial) {
        setMsgs((m) => [...m, especial]);
      } else {
        log('Consultando métricas');
        const r = await api.post<{ respuesta: string }>('/api/chat', { pregunta: q });
        log('Generando respuesta');
        setMsgs((m) => [...m, { role: 'ai', text: r.respuesta, timestamp: horaAhora() }]);
      }
    } catch (err) {
      setMsgs((m) => [...m, { role: 'ai', text: `No pude obtener una respuesta (${String(err)}).`, timestamp: horaAhora() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong }}>Copiloto BI</div>
        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.4 }}>Consulta los resultados de la operación en lenguaje natural.</div>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '10px 16px 0', borderBottom: `1px solid ${colors.border}` }}>
        {(['copiloto', 'actividad'] as const).map((t) => (
          <div key={t} onClick={() => setTab(t)} style={{ paddingBottom: 10, fontSize: 12, fontWeight: 600, color: tab === t ? colors.textStrong : colors.textMuted, borderBottom: tab === t ? `2px solid ${colors.blue}` : '2px solid transparent', cursor: 'pointer' }}>
            {t === 'copiloto' ? 'Copiloto' : 'Actividad'}
          </div>
        ))}
      </div>

      {tab === 'actividad' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actividad.length === 0 && <div style={{ fontSize: 12, color: colors.textFaint }}>Sin actividad todavía.</div>}
          {actividad.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, color: colors.text }}>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: colors.textFaint, flexShrink: 0 }}>{a.hora}</span>
              <span>{a.texto}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msgs.length === 0 && (
              <div style={{ fontSize: 12, color: colors.textFaint, lineHeight: 1.6 }}>
                Consulta los datos de la operación.<br />Puedes preguntar sobre cartera, pagos, clientes, facturación y recupero.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '96%', width: m.tabla ? '100%' : undefined }}>
                <div style={m.role === 'user'
                  ? { background: colors.navy, color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '9px 12px', fontSize: 12, lineHeight: 1.5, marginLeft: 'auto', width: 'fit-content' }
                  : { background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: '10px 10px 10px 2px', padding: '9px 12px', fontSize: 12, color: colors.text, lineHeight: 1.5 }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 9.5, color: colors.textFaint, marginTop: 2, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.timestamp}</div>
                {m.tabla && <BIResultTable spec={m.tabla} />}
                {(m.barSpec || m.lineSpec) && (
                  <button
                    onClick={() => { if (m.barSpec) onAplicarBar(m.barSpec); if (m.lineSpec) onAplicarLine(m.lineSpec); }}
                    style={{ marginTop: 8, height: 28, padding: '0 12px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Aplicar al gráfico
                  </button>
                )}
              </div>
            ))}
            {loading && <div style={{ fontSize: 11, color: colors.textFaint }}>Consultando datos de la operación...</div>}
          </div>

          <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Pregúntale a TRAZA sobre la operación..."
                rows={1}
                style={{ flex: 1, minHeight: 40, maxHeight: 100, background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 7, padding: '9px 12px', fontSize: 12, color: colors.text, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button onClick={enviar} style={{ width: 40, height: 40, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>➤</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
