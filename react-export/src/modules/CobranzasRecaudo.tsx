import { useEffect, useState } from 'react';
import { colors, monoFont, pagoProbStyle, tabStyle } from '../lib/styles';
import { api, fecha, fechaHora, money } from '../lib/api';
import Drawer from '../components/Drawer';
import FilterSelect from '../components/FilterSelect';

type Resumen = { cartera_pendiente: number; cartera_vencida: number; ratio_cobrado_facturado: number; clientes_riesgo_alto: number; facturas_en_cartera: number };
type CarteraRow = { factura_id: string; numero: string; cliente_id: string; razon_social: string; saldo_pendiente: number; fecha_vencimiento: string; dias_vencidos: number; aging: string; estado_pago: string };
type Email = { id: string; cliente_nombre: string | null; asunto: string; cuerpo: string; clasificacion: string | null; confianza: number | null; procesado: boolean; recibido_at: string; adjuntos: { nombre: string }[]; factura_id: string | null };
type Caso = { id: string; cliente_nombre: string | null; tipo_caso: string; descripcion: string | null; impacto_monto: number | null; prioridad: string; estado: string };
type Movimiento = { id: string; fecha_movimiento: string; banco: string; nro_operacion: string; monto: number; estado: string; cliente_sugerido?: string; factura_sugerida?: string; match?: any };

const TABS = [
  { id: 'resumen', label: 'Resumen de cartera' },
  { id: 'gestion', label: 'Gestión de cobranza' },
  { id: 'bandeja', label: 'Bandeja IA' },
  { id: 'conciliacion', label: 'Conciliación y recaudo' },
] as const;
type TabId = typeof TABS[number]['id'];

function tagBox(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, color, background: bg, borderRadius: 5, padding: '4px 9px' };
}
function agingStyle(a: string) {
  if (a === 'POR_VENCER') return tagBox(colors.greenDark, colors.greenBg);
  if (a === '0_30') return tagBox(colors.blueDark, colors.blueBg);
  if (a === '31_60') return tagBox(colors.amberDark, colors.amberBg);
  return tagBox(colors.redDark, colors.redBg);
}
function clasifStyle(c: string | null) {
  if (c === 'CONFIRMACION_PAGO') return tagBox(colors.greenDark, colors.greenBg);
  if (c === 'PROMESA_PAGO') return tagBox(colors.amberDark, colors.amberBg);
  if (c === 'CONSULTA') return tagBox(colors.blueDark, colors.blueBg);
  if (c === 'RECLAMO') return tagBox(colors.redDark, colors.redBg);
  return tagBox('#64748B', '#F1F4F8');
}
function conciliacionEstadoStyle(e: string) {
  if (e === 'CONCILIADO') return tagBox(colors.greenDark, colors.greenBg);
  if (e === 'IDENTIFICADO') return tagBox(colors.blueDark, colors.blueBg);
  return tagBox(colors.amberDark, colors.amberBg);
}

export default function CobranzasRecaudo() {
  const [tab, setTab] = useState<TabId>('resumen');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cartera, setCartera] = useState<CarteraRow[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [gestionFacturaId, setGestionFacturaId] = useState<string | null>(null);
  const [emailSeleccionado, setEmailSeleccionado] = useState<Email | null>(null);
  const [movSeleccionado, setMovSeleccionado] = useState<string | null>(null);

  const [filtroAging, setFiltroAging] = useState('TODOS');
  const [filtroClasificacion, setFiltroClasificacion] = useState('TODOS');
  const [filtroEstadoMov, setFiltroEstadoMov] = useState('TODOS');

  const cargar = () => {
    api.get<Resumen>('/api/cobranzas/resumen').then(setResumen);
    api.get<CarteraRow[]>(`/api/cobranzas/cartera?limit=100&aging=${filtroAging}`).then(setCartera);
    api.get<Email[]>(`/api/cobranzas/emails?limit=50&clasificacion=${filtroClasificacion}`).then(setEmails);
    api.get<Caso[]>('/api/cobranzas/casos').then(setCasos);
    api.get<Movimiento[]>(`/api/recaudo/movimientos?limit=100&estado=${filtroEstadoMov}`).then(setMovimientos);
  };
  useEffect(() => { cargar(); }, [filtroAging, filtroClasificacion, filtroEstadoMov]);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Cobranzas &amp; Recaudo</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Visión general del estado de recuperación del ingreso.</div>
      </div>

      <div style={{ display: 'flex', gap: 26, borderBottom: `1px solid ${colors.border}`, marginBottom: 24 }}>
        {TABS.map((t) => <div key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</div>)}
      </div>

      {tab === 'resumen' && resumen && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 18 }}>
            <Kpi label="Cartera pendiente" value={money(resumen.cartera_pendiente)} />
            <Kpi label="Cartera vencida" value={money(resumen.cartera_vencida)} deltaColor={colors.redDark} />
            <Kpi label="Ratio cobrado/facturado" value={`${(resumen.ratio_cobrado_facturado * 100).toFixed(1)}%`} deltaColor={colors.greenDark} />
            <Kpi label="Clientes en riesgo alto" value={String(resumen.clientes_riesgo_alto)} deltaColor={colors.amberDark} />
          </div>

          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14, fontWeight: 700, color: colors.textStrong }}>Cartera con mayor antigüedad</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>CLIENTE</th><th style={th('left')}>FACTURA</th><th style={th('right')}>SALDO</th>
                <th style={th('right')}>DÍAS VENCIDOS</th><th style={th('left')}>AGING</th><th style={th('right', 20)}></th>
              </tr></thead>
              <tbody>
                {cartera.slice(0, 10).map((c) => (
                  <tr key={c.factura_id}>
                    <td style={{ ...monoFont, padding: '11px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{c.razon_social}</td>
                    <td style={{ ...monoFont, padding: '11px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12.5, color: colors.text }}>{c.numero}</td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right' }}>{money(c.saldo_pendiente)}</td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text, textAlign: 'right' }}>{c.dias_vencidos}</td>
                    <td style={{ padding: '11px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={agingStyle(c.aging)}>{c.aging}</span></td>
                    <td style={{ padding: '11px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}><button onClick={() => { setTab('gestion'); setGestionFacturaId(c.factura_id); }} style={btnGhost}>Gestionar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'gestion' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <FilterSelect label="Antigüedad (aging)" value={filtroAging} onChange={setFiltroAging} options={[
              { value: 'TODOS', label: 'Todos' }, { value: 'POR_VENCER', label: 'Por vencer' },
              { value: '0_30', label: '0-30 días' }, { value: '31_60', label: '31-60 días' },
              { value: '61_90', label: '61-90 días' }, { value: 'MAS_90', label: '+90 días' },
            ]} />
          </div>
          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>CLIENTE</th><th style={th('left')}>FACTURA</th><th style={th('right')}>SALDO</th>
                <th style={th('right')}>DÍAS VENCIDO</th><th style={th('left')}>AGING</th><th style={th('right', 20)}></th>
              </tr></thead>
              <tbody>
                {cartera.map((c) => (
                  <tr key={c.factura_id}>
                    <td style={{ ...monoFont, padding: '13px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{c.razon_social}</td>
                    <td style={{ ...monoFont, padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{c.numero}</td>
                    <td style={{ padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right' }}>{money(c.saldo_pendiente)}</td>
                    <td style={{ padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text, textAlign: 'right' }}>{c.dias_vencidos}</td>
                    <td style={{ padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={agingStyle(c.aging)}>{c.aging}</span></td>
                    <td style={{ padding: '13px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}>
                      <button onClick={() => setGestionFacturaId(c.factura_id)} style={btnGhost}>Gestionar caso</button>
                    </td>
                  </tr>
                ))}
                {cartera.length === 0 && <tr><td colSpan={6} style={{ padding: 20, fontSize: 13, color: colors.textFaint }}>No hay cartera pendiente.</td></tr>}
              </tbody>
            </table>
          </div>
          <GestionDrawer facturaId={gestionFacturaId} onClose={() => setGestionFacturaId(null)} onCambio={cargar} irAConciliacion={() => { setGestionFacturaId(null); setTab('conciliacion'); }} />
        </div>
      )}

      {tab === 'bandeja' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <FilterSelect label="Clasificación" value={filtroClasificacion} onChange={setFiltroClasificacion} options={[
              { value: 'TODOS', label: 'Todos' }, { value: 'CONFIRMACION_PAGO', label: 'Confirmación de pago' },
              { value: 'PROMESA_PAGO', label: 'Promesa de pago' }, { value: 'CONSULTA', label: 'Consulta' },
              { value: 'RECLAMO', label: 'Reclamo' }, { value: 'NOTA_CREDITO', label: 'Nota de crédito' }, { value: 'OTRO', label: 'Otro' },
            ]} />
            <button onClick={() => api.post('/api/cobranzas/procesar-lote').then(cargar)} style={btnLight}>Clasificar pendientes</button>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>FECHA</th><th style={th('left')}>CLIENTE</th><th style={th('left')}>ASUNTO</th>
                <th style={th('left')}>CLASIFICACIÓN</th><th style={th('right', 20)}></th>
              </tr></thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: '13px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12, color: colors.textMuted }}>{fecha(e.recibido_at)}</td>
                    <td style={{ ...monoFont, padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{e.cliente_nombre || '—'}</td>
                    <td style={{ padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{e.asunto}</td>
                    <td style={{ padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={clasifStyle(e.clasificacion)}>{e.clasificacion || 'Sin clasificar'}</span></td>
                    <td style={{ padding: '13px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}><button onClick={() => setEmailSeleccionado(e)} style={btnGhost}>Ver correo</button></td>
                  </tr>
                ))}
                {emails.length === 0 && <tr><td colSpan={5} style={{ padding: 20, fontSize: 13, color: colors.textFaint }}>Sin correos en la bandeja.</td></tr>}
              </tbody>
            </table>
          </div>
          <EmailDrawer email={emailSeleccionado} onClose={() => setEmailSeleccionado(null)} onCambio={() => { cargar(); }} />
        </div>
      )}

      {tab === 'conciliacion' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, flex: 1 }}>
              <Kpi label="Movimientos pendientes" value={String(movimientos.filter((m) => m.estado !== 'CONCILIADO').length)} />
              <Kpi label="Conciliados" value={String(movimientos.filter((m) => m.estado === 'CONCILIADO').length)} />
            </div>
            <button onClick={() => api.post('/api/recaudo/procesar-lote').then(cargar)} style={{ ...btnDark, height: 36, marginLeft: 16 }}>Conciliar automáticos</button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <FilterSelect label="Estado" value={filtroEstadoMov} onChange={setFiltroEstadoMov} options={[
              { value: 'TODOS', label: 'Todos' }, { value: 'PENDIENTE', label: 'Pendiente' },
              { value: 'IDENTIFICADO', label: 'Identificado' }, { value: 'CONCILIADO', label: 'Conciliado' },
              { value: 'DESCARTADO', label: 'Descartado' },
            ]} />
          </div>
          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Movimientos bancarios (fuente simulada del MVP)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>FECHA</th><th style={th('right')}>MONTO</th><th style={th('left')}>CLIENTE SUGERIDO</th>
                <th style={th('left')}>FACTURA</th><th style={th('left')}>ESTADO</th><th style={th('right', 20)}>ACCIÓN</th>
              </tr></thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: '13px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12.5, color: colors.textMuted }}>{fecha(m.fecha_movimiento)}</td>
                    <td style={{ padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right' }}>{money(m.monto)}</td>
                    <td style={{ ...monoFont, padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{m.cliente_sugerido || '—'}</td>
                    <td style={{ ...monoFont, padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{m.factura_sugerida || '—'}</td>
                    <td style={{ padding: '13px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={conciliacionEstadoStyle(m.estado)}>{m.estado}</span></td>
                    <td style={{ padding: '13px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}><button onClick={() => setMovSeleccionado(m.id)} style={btnGhost}>Ver detalle</button></td>
                  </tr>
                ))}
                {movimientos.length === 0 && <tr><td colSpan={6} style={{ padding: 20, fontSize: 13, color: colors.textFaint }}>No hay movimientos bancarios registrados.</td></tr>}
              </tbody>
            </table>
          </div>
          <MovimientoDrawer movId={movSeleccionado} onClose={() => setMovSeleccionado(null)} onCambio={cargar} />
        </div>
      )}
    </div>
  );
}

function GestionDrawer({ facturaId, onClose, onCambio, irAConciliacion }: { facturaId: string | null; onClose: () => void; onCambio: () => void; irAConciliacion: () => void }) {
  const [data, setData] = useState<any>(null);
  const [notas, setNotas] = useState('');
  const [montoPromesa, setMontoPromesa] = useState('');
  const [fechaPromesa, setFechaPromesa] = useState('');

  useEffect(() => {
    if (facturaId) api.get(`/api/cobranzas/gestion/${facturaId}`).then(setData);
    else setData(null);
  }, [facturaId]);

  if (!facturaId) return null;
  const clasif = data?.ultimo_email?.clasificacion;

  return (
    <Drawer open={!!facturaId} onClose={onClose} width={440} title="Gestionar caso" subtitle={data && <div style={{ ...monoFont, fontSize: 12.5, color: colors.textMuted }}>{data.cliente?.razon_social}</div>}
      footer={(
        <>
          <button onClick={async () => { await api.post(`/api/cobranzas/gestiones/${facturaId}`, { notas }); onCambio(); onClose(); }} style={{ height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Guardar gestión</button>
          {clasif === 'CONFIRMACION_PAGO' && <button onClick={irAConciliacion} style={btnLight}>Ir a conciliación</button>}
        </>
      )}>
      {data && (
        <>
          <Section title="RESUMEN DEL CASO">
            <InfoBox rows={[
              ['Cliente', data.cliente?.razon_social, false], ['Factura', data.factura?.numero, true],
              ['Monto', money(data.factura?.monto), false], ['Vencimiento', fecha(data.factura?.fecha_vencimiento), false],
              ['Estado gestión', data.gestion?.estado || 'PENDIENTE', false],
            ]} />
          </Section>
          <Section title="ÚLTIMA COMUNICACIÓN">
            {data.ultimo_email ? (
              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 11.5, color: colors.textFaint, marginBottom: 6 }}>{fechaHora(data.ultimo_email.recibido_at)}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong, marginBottom: 6 }}>{data.ultimo_email.asunto}</div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>{data.ultimo_email.cuerpo}</div>
                {data.ultimo_email.clasificacion && <span style={{ ...clasifBox(data.ultimo_email.clasificacion), marginTop: 10, display: 'inline-block' }}>{data.ultimo_email.clasificacion}</span>}
              </div>
            ) : <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, color: colors.textFaint }}>Sin comunicación reciente de este cliente.</div>}
          </Section>
          <Section title="REGISTRAR PROMESA DE PAGO">
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={montoPromesa} onChange={(e) => setMontoPromesa(e.target.value)} placeholder="Monto" style={inputStyle} />
              <input value={fechaPromesa} onChange={(e) => setFechaPromesa(e.target.value)} type="date" style={inputStyle} />
              <button onClick={async () => {
                if (!montoPromesa || !fechaPromesa) return;
                await api.post(`/api/cobranzas/promesas/${facturaId}`, { monto: Number(montoPromesa), fecha_prometida: fechaPromesa });
                setMontoPromesa(''); setFechaPromesa(''); onCambio();
              }} style={btnDark}>Registrar</button>
            </div>
          </Section>
          <Section title="NOTAS DEL ANALISTA">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Registra información relevante sobre la gestión..."
              style={{ width: '100%', minHeight: 64, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          </Section>
        </>
      )}
    </Drawer>
  );
}

function EmailDrawer({ email, onClose, onCambio }: { email: Email | null; onClose: () => void; onCambio: () => void }) {
  const [clasificando, setClasificando] = useState(false);
  if (!email) return null;
  const clasificar = async () => {
    setClasificando(true);
    try { await api.post(`/api/cobranzas/emails/${email.id}/clasificar`); onCambio(); onClose(); } finally { setClasificando(false); }
  };
  return (
    <Drawer open={!!email} onClose={onClose} width={440} title={email.asunto} subtitle={<span style={{ ...monoFont, fontSize: 12.5, color: colors.textMuted }}>{email.cliente_nombre}</span>}
      footer={(
        <>
          {!email.procesado && <button onClick={clasificar} disabled={clasificando} style={{ height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{clasificando ? 'Clasificando…' : 'Clasificar con IA'}</button>}
          <button onClick={onClose} style={btnLight}>Cerrar</button>
        </>
      )}>
      <div style={{ fontSize: 11.5, color: colors.textFaint, marginBottom: 10 }}>{fechaHora(email.recibido_at)}</div>
      <div style={{ fontSize: 13.5, color: colors.text, lineHeight: 1.6, marginBottom: 16 }}>{email.cuerpo}</div>
      {email.adjuntos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {email.adjuntos.map((a, i) => <span key={i} style={{ ...monoFont, fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '6px 10px' }}>{a.nombre}</span>)}
        </div>
      )}
      {email.clasificacion ? (
        <div style={{ background: colors.blueBg, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: colors.blueDark, marginBottom: 6 }}>CLASIFICACIÓN TRAZA</div>
          <span style={clasifBox(email.clasificacion)}>{email.clasificacion}</span>
          {email.confianza != null && <div style={{ fontSize: 12.5, color: colors.text, marginTop: 8 }}>Confianza: {(email.confianza * 100).toFixed(0)}%</div>}
        </div>
      ) : (
        <div style={{ background: colors.amberBg, borderRadius: 8, padding: '14px 16px', fontSize: 13, color: colors.amberDark, fontWeight: 600 }}>Pendiente de clasificación.</div>
      )}
    </Drawer>
  );
}

function MovimientoDrawer({ movId, onClose, onCambio }: { movId: string | null; onClose: () => void; onCambio: () => void }) {
  const [data, setData] = useState<any>(null);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (movId) api.get(`/api/recaudo/movimientos/${movId}`).then(setData);
    else setData(null);
  }, [movId]);

  if (!movId || !data) return movId ? <Drawer open onClose={onClose} title="Cargando…">{null}</Drawer> : null;

  const mov = data.movimiento;
  const match = data.match;
  const puedeConfirmar = match && match.factura_id && match.estado === 'SUGERIDO';

  return (
    <Drawer open={!!movId} onClose={onClose} width={480} title="Detalle del movimiento" subtitle={<span style={conciliacionEstadoStyle(mov.estado)}>{mov.estado}</span>}
      footer={(
        <>
          {!match && <button onClick={async () => { await api.post(`/api/recaudo/movimientos/${movId}/evaluar`); const d: any = await api.get(`/api/recaudo/movimientos/${movId}`); setData(d); onCambio(); }} style={{ height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Evaluar match</button>}
          {puedeConfirmar && <button onClick={async () => { await api.post(`/api/recaudo/matches/${match.id}/confirmar`, {}); onCambio(); onClose(); }} style={{ height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Confirmar coincidencia</button>}
          {puedeConfirmar && <button onClick={async () => { await api.post(`/api/recaudo/matches/${match.id}/rechazar`, { motivo: motivo || 'Rechazado por el analista' }); onCambio(); onClose(); }} style={btnLight}>Rechazar sugerencia</button>}
          <button onClick={onClose} style={btnLight}>Cerrar</button>
        </>
      )}>
      <Section title="MOVIMIENTO BANCARIO">
        <InfoBox rows={[['Monto', money(mov.monto), false], ['Fecha', fecha(mov.fecha_movimiento), false], ['Operación', mov.nro_operacion, true], ['Banco', mov.banco, false]]} />
      </Section>
      {match ? (
        <>
          <Section title={`COINCIDENCIA (${match.tipo_match}, score ${(match.score * 100).toFixed(0)}%)`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(match.criterios || {}).filter(([k]) => k !== 'candidatos_alternativos').map(([k, v]: any) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12.5, color: colors.text }}>
                  <span style={{ color: v ? colors.green : colors.textFaint, fontWeight: 700 }}>{v ? '✓' : '—'}</span>{k.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          </Section>
          {data.candidatos && data.candidatos.length > 0 && (
            <Section title="OTROS CANDIDATOS">
              {data.candidatos.slice(0, 4).map((c: any, i: number) => (
                <div key={i} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ ...monoFont, fontSize: 12.5 }}>{c.factura_numero} · {c.cliente_nombre}</span>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>{(c.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </Section>
          )}
          {puedeConfirmar && (
            <Section title="MOTIVO SI RECHAZA (opcional)">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del rechazo..." style={inputStyle} />
            </Section>
          )}
        </>
      ) : (
        <div style={{ background: colors.amberBg, border: '1px solid #FDE8B8', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: colors.amberDark, fontWeight: 600 }}>Aún no se evaluó este movimiento contra la cartera pendiente.</div>
      )}
    </Drawer>
  );
}

function clasifBox(c: string) {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, borderRadius: 5, padding: '4px 9px', ...clasifStyle(c) };
}

function InfoBox({ rows }: { rows: [string, any, boolean][] }) {
  return (
    <div style={{ background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map(([label, value, mono]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: colors.textMuted }}>{label}</span>
          <span style={{ fontWeight: 600, color: colors.textStrong, ...(mono ? monoFont : {}) }}>{value}</span>
        </div>
      ))}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 22 }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: colors.textMuted, marginBottom: 10 }}>{title}</div>{children}</div>;
}
function Kpi({ label, value, deltaColor }: { label: string; value: string; deltaColor?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: deltaColor || colors.textStrong, marginTop: 6 }}>{value}</div>
    </div>
  );
}
function th(align: 'left' | 'right', pad = 12): React.CSSProperties {
  return { textAlign: align, fontSize: 11, fontWeight: 600, color: colors.textMuted, padding: `10px ${pad}px`, borderBottom: `1px solid ${colors.border}` };
}
const inputStyle: React.CSSProperties = { height: 36, flex: 1, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const btnDark: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnLight: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { height: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
