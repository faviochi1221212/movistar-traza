import { useEffect, useMemo, useState } from 'react';
import { colors, monoFont, tabStyle, priorityStyle } from '../lib/styles';
import { api, money } from '../lib/api';
import FilterSelect from '../components/FilterSelect';

type ResumenGeneral = {
  facturacion: { monto_facturado: number };
  cobranzas: { cartera_pendiente: number; cartera_vencida: number };
  recaudo: { conciliaciones_automaticas: number; conciliaciones_manuales: number; movimientos_pendientes: number; monto_pagado_aplicado: number };
};
type CarteraRow = { factura_id: string; cliente_id: string; razon_social: string; saldo_pendiente: number; dias_vencidos: number; aging: string };
type RiesgoCliente = { cliente_id: string; razon_social: string; probabilidad_pago: number; nivel_riesgo: string; saldo_pendiente: number; dias_vencidos: number };
type Oportunidad = { cliente_id: string; razon_social: string; saldo_pendiente: number; dias_vencidos: number; facturas_vencidas: number; probabilidad_pago: number; nivel_riesgo: string; prioridad: string; oportunidad: string; accion_sugerida: string };

const TABS = [
  { id: 'resumen', label: 'Resumen de cartera' },
  { id: 'riesgo', label: 'Riesgo y predicción' },
  { id: 'oportunidades', label: 'Oportunidades de recupero' },
  { id: 'consultas', label: 'Consultas IA' },
] as const;
type TabId = typeof TABS[number]['id'];

function tagBox(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, color, background: bg, borderRadius: 5, padding: '4px 9px' };
}
function riesgoTagStyle(r: string) {
  return r === 'ALTO' ? tagBox(colors.redDark, colors.redBg) : r === 'MEDIO' ? tagBox(colors.amberDark, colors.amberBg) : tagBox(colors.greenDark, colors.greenBg);
}
function probStyle(p: number) {
  const pct = p * 100;
  return pct < 30 ? tagBox(colors.redDark, colors.redBg) : pct < 70 ? tagBox(colors.amberDark, colors.amberBg) : tagBox(colors.greenDark, colors.greenBg);
}
function th(align: 'left' | 'right', pad = 12): React.CSSProperties {
  return { textAlign: align, fontSize: 11, fontWeight: 600, color: colors.textMuted, padding: `10px ${pad}px`, borderBottom: `1px solid ${colors.border}` };
}
const btnGhost: React.CSSProperties = { height: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };

const AGING_ORDER = ['POR_VENCER', '0_30', '31_60', '61_90', 'MAS_90'];
const AGING_LABEL: Record<string, string> = { POR_VENCER: 'Por vencer', '0_30': '0-30 días', '31_60': '31-60 días', '61_90': '61-90 días', MAS_90: '+90 días' };

const SUGGESTIONS = ['¿Cuáles clientes tienen mayor riesgo este mes?', '¿Cuál es la cartera vencida actual?', '¿Cuáles son las oportunidades de recuperación más grandes?'];

export default function BIRecupero() {
  const [tab, setTab] = useState<TabId>('resumen');
  const [resumen, setResumen] = useState<ResumenGeneral | null>(null);
  const [cartera, setCartera] = useState<CarteraRow[]>([]);
  const [riesgo, setRiesgo] = useState<{ resumen: { distribucion: Record<string, number>; total_evaluados: number; sin_historial: number }; top_clientes: RiesgoCliente[] } | null>(null);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [chatMsgs, setChatMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [filtroNivelRiesgo, setFiltroNivelRiesgo] = useState('TODOS');
  const [filtroPrioridad, setFiltroPrioridad] = useState('TODOS');

  useEffect(() => {
    api.get<ResumenGeneral>('/api/bi/resumen').then(setResumen);
    api.get<CarteraRow[]>('/api/cobranzas/cartera?limit=500').then(setCartera);
  }, []);

  useEffect(() => {
    api.get(`/api/bi/riesgo?limit=20&nivel_riesgo=${filtroNivelRiesgo}`).then(setRiesgo as any);
  }, [filtroNivelRiesgo]);

  useEffect(() => {
    api.get<Oportunidad[]>(`/api/bi/recupero?limit=30&prioridad=${filtroPrioridad}`).then(setOportunidades);
  }, [filtroPrioridad]);

  const porAging = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of cartera) acc[c.aging] = (acc[c.aging] || 0) + Number(c.saldo_pendiente);
    return acc;
  }, [cartera]);
  const maxAging = Math.max(1, ...Object.values(porAging));

  const concentraciones = useMemo(() => {
    const acc: Record<string, { razon_social: string; monto: number }> = {};
    for (const c of cartera) {
      if (!acc[c.cliente_id]) acc[c.cliente_id] = { razon_social: c.razon_social, monto: 0 };
      acc[c.cliente_id].monto += Number(c.saldo_pendiente);
    }
    return Object.values(acc).sort((a, b) => b.monto - a.monto).slice(0, 8);
  }, [cartera]);

  const send = async (q?: string) => {
    const pregunta = (q ?? chatInput).trim();
    if (!pregunta || chatLoading) return;
    setChatMsgs((m) => [...m, { role: 'user', text: pregunta }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const r = await api.post<{ respuesta: string }>('/api/chat', { pregunta });
      setChatMsgs((m) => [...m, { role: 'ai', text: r.respuesta }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>BI &amp; Recupero</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Análisis del ingreso, riesgo y oportunidades de recuperación.</div>
      </div>

      <div style={{ display: 'flex', gap: 26, borderBottom: `1px solid ${colors.border}`, marginBottom: 24 }}>
        {TABS.map((t) => <div key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</div>)}
      </div>

      {tab === 'resumen' && resumen && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 18 }}>
            <Kpi label="Monto facturado" value={money(resumen.facturacion.monto_facturado)} />
            <Kpi label="Cartera pendiente" value={money(resumen.cobranzas.cartera_pendiente)} />
            <Kpi label="Cartera vencida" value={money(resumen.cobranzas.cartera_vencida)} color={colors.redDark} />
            <Kpi label="Monto aplicado (recaudo)" value={money(resumen.recaudo.monto_pagado_aplicado)} color={colors.greenDark} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 18 }}>
            <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 20 }}>Cartera por antigüedad</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, height: 150, padding: '0 6px' }}>
                {AGING_ORDER.map((key) => {
                  const v = porAging[key] || 0;
                  const h = Math.max(4, (v / maxAging) * 130);
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.textStrong }}>{money(v)}</div>
                      <div style={{ width: 44, height: h, background: colors.blue, borderRadius: '4px 4px 0 0' }} />
                      <div style={{ fontSize: 11, color: colors.textMuted }}>{AGING_LABEL[key]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 16 }}>Recaudo</div>
              <div style={{ fontSize: 12.5, color: colors.text, marginBottom: 8 }}>Conciliaciones automáticas: <b>{resumen.recaudo.conciliaciones_automaticas}</b></div>
              <div style={{ fontSize: 12.5, color: colors.text, marginBottom: 8 }}>Conciliaciones manuales: <b>{resumen.recaudo.conciliaciones_manuales}</b></div>
              <div style={{ fontSize: 12.5, color: colors.text }}>Movimientos pendientes: <b>{resumen.recaudo.movimientos_pendientes}</b></div>
            </div>
          </div>

          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Principales concentraciones de deuda</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC' }}><th style={th('left', 20)}>CLIENTE</th><th style={th('right', 20)}>MONTO PENDIENTE</th></tr></thead>
              <tbody>
                {concentraciones.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...monoFont, padding: '12px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{c.razon_social}</td>
                    <td style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right' }}>{money(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'riesgo' && riesgo && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 8 }}>
            <KpiIcon label="Clientes evaluados" value={String(riesgo.resumen.total_evaluados)} bg={colors.blueBg} border={colors.blue} />
            <KpiIcon label="Riesgo alto" value={String(riesgo.resumen.distribucion.ALTO || 0)} bg={colors.redBg} border={colors.red} />
            <KpiIcon label="Riesgo medio" value={String(riesgo.resumen.distribucion.MEDIO || 0)} bg={colors.amberBg} border={colors.amber} />
            <KpiIcon label="Riesgo bajo" value={String(riesgo.resumen.distribucion.BAJO || 0)} bg={colors.greenBg} border={colors.green} />
            <KpiIcon label="Sin historial" value={String(riesgo.resumen.sin_historial)} bg="#F1F4F8" border="#94A3B8" />
          </div>
          {riesgo.resumen.sin_historial > 0 && (
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 18 }}>
              {riesgo.resumen.sin_historial} cliente(s) activo(s) sin ninguna factura registrada: no se evalúan (no hay historial de pago con el que el modelo pueda estimar probabilidad de pago).
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <FilterSelect label="Nivel de riesgo" value={filtroNivelRiesgo} onChange={setFiltroNivelRiesgo} options={[
              { value: 'TODOS', label: 'Todos' }, { value: 'ALTO', label: 'Alto' }, { value: 'MEDIO', label: 'Medio' }, { value: 'BAJO', label: 'Bajo' },
            ]} />
          </div>

          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Clientes con mayor riesgo (ordenado por saldo pendiente y días vencidos)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>CLIENTE</th><th style={th('right')}>PROB. PAGO</th><th style={th('left')}>NIVEL</th>
                <th style={th('right')}>SALDO</th><th style={th('right', 20)}>DÍAS VENCIDO</th>
              </tr></thead>
              <tbody>
                {riesgo.top_clientes.map((rk) => (
                  <tr key={rk.cliente_id}>
                    <td style={{ ...monoFont, padding: '12px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{rk.razon_social}</td>
                    <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}><span style={probStyle(rk.probabilidad_pago)}>{(rk.probabilidad_pago * 100).toFixed(1)}%</span></td>
                    <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={riesgoTagStyle(rk.nivel_riesgo)}>{rk.nivel_riesgo}</span></td>
                    <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text, textAlign: 'right' }}>{money(rk.saldo_pendiente)}</td>
                    <td style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text, textAlign: 'right' }}>{rk.dias_vencidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'oportunidades' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
            <KpiIcon label="Oportunidades detectadas" value={String(oportunidades.length)} bg={colors.blueBg} border={colors.blue} />
            <KpiIcon label="Impacto estimado" value={money(oportunidades.reduce((s, o) => s + Number(o.saldo_pendiente), 0))} bg={colors.greenBg} border={colors.green} />
            <KpiIcon label="Prioridad alta" value={String(oportunidades.filter((o) => o.prioridad === 'Alta').length)} bg={colors.amberBg} border={colors.amber} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <FilterSelect label="Prioridad" value={filtroPrioridad} onChange={setFiltroPrioridad} options={[
              { value: 'TODOS', label: 'Todas' }, { value: 'Alta', label: 'Alta' }, { value: 'Media', label: 'Media' }, { value: 'Baja', label: 'Baja' },
            ]} />
          </div>

          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Oportunidades de recupero</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>PRIORIDAD</th><th style={th('left')}>CLIENTE</th><th style={th('left')}>OPORTUNIDAD</th>
                <th style={th('right')}>SALDO</th><th style={th('left')}>ACCIÓN SUGERIDA</th>
              </tr></thead>
              <tbody>
                {oportunidades.map((op, i) => (
                  <tr key={i}>
                    <td style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={priorityStyle(op.prioridad as any)}>{op.prioridad}</span></td>
                    <td style={{ ...monoFont, padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{op.razon_social}</td>
                    <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{op.oportunidad}</td>
                    <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right' }}>{money(op.saldo_pendiente)}</td>
                    <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{op.accion_sugerida}</td>
                  </tr>
                ))}
                {oportunidades.length === 0 && <tr><td colSpan={5} style={{ padding: 20, fontSize: 13, color: colors.textFaint }}>No se identificaron oportunidades.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'consultas' && (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', height: 560 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong }}>Consulta con TRAZA</div>
            <button onClick={() => setChatMsgs([])} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Limpiar conversación</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {chatMsgs.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14, padding: '0 30px' }}>
                <div style={{ fontSize: 13.5, color: colors.textMuted, lineHeight: 1.6 }}>Haz una pregunta sobre riesgo, cartera u oportunidades de recupero.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360 }}>
                  {SUGGESTIONS.map((s) => <div key={s} onClick={() => send(s)} style={{ fontSize: 12.5, color: colors.blueDark, background: colors.blueBg, borderRadius: 6, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' }}>{s}</div>)}
                </div>
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} style={m.role === 'user'
                ? { alignSelf: 'flex-end', maxWidth: '75%', background: colors.navy, color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '10px 14px', fontSize: 13.5 }
                : { alignSelf: 'flex-start', maxWidth: '80%', background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: '10px 10px 10px 2px', padding: '12px 14px', fontSize: 13.5, color: colors.text, lineHeight: 1.6 }}>
                {m.text}
              </div>
            ))}
            {chatLoading && <div style={{ fontSize: 12.5, color: colors.textFaint }}>TRAZA está pensando…</div>}
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Escribe tu consulta..." style={{ flex: 1, height: 38, border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={() => send()} style={{ width: 38, height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 14, cursor: 'pointer' }}>➜</button>
            </div>
            <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 8 }}>TRAZA puede cometer errores. Verifica la información antes de tomar decisiones.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: color || colors.textStrong, marginTop: 6 }}>{value}</div>
    </div>
  );
}
function KpiIcon({ label, value, bg, border }: { label: string; value: string; bg: string; border: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 13, height: 13, border: `1.6px solid ${border}`, borderRadius: '50%' }} /></div>
      <div><div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, color: colors.textStrong }}>{value}</div></div>
    </div>
  );
}
