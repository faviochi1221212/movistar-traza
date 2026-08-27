import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { colors, monoFont } from '../lib/styles';
import { api, fecha, fechaHora, money } from '../lib/api';
import Drawer from '../components/Drawer';
import { motionTokens } from '../lib/motionTokens';
import ControlColumn from '../components/cobranzas/ControlColumn';
import InboxColumn from '../components/cobranzas/InboxColumn';
import DetailColumn from '../components/cobranzas/DetailColumn';
import CopilotColumn from '../components/cobranzas/CopilotColumn';

type Resumen = { cartera_pendiente: number; cartera_vencida: number; ratio_cobrado_facturado: number; clientes_riesgo_alto: number; facturas_en_cartera: number };
type CarteraRow = { factura_id: string; numero: string; cliente_id: string; razon_social: string; saldo_pendiente: number; fecha_vencimiento: string; dias_vencidos: number; aging: string; estado_pago: string };
type Email = { id: string; cliente_nombre: string | null; asunto: string; cuerpo: string; clasificacion: string | null; confianza: number | null; procesado: boolean; recibido_at: string; adjuntos: { nombre: string }[]; factura_id: string | null };
type MatchInfo = { id: string; score: number; criterios: Record<string, any>; estado: string; tipo_match: string; factura_id: string };
type Movimiento = { id: string; fecha_movimiento: string; banco: string; nro_operacion: string; monto: number; estado: string; cliente_sugerido?: string; factura_sugerida?: string; match?: MatchInfo | null };

function clasifStyle(c: string | null) {
  if (c === 'CONFIRMACION_PAGO') return { color: colors.greenDark, bg: colors.greenBg };
  if (c === 'PROMESA_PAGO') return { color: colors.amberDark, bg: colors.amberBg };
  if (c === 'CONSULTA') return { color: colors.blueDark, bg: colors.blueBg };
  if (c === 'RECLAMO') return { color: colors.redDark, bg: colors.redBg };
  return { color: '#64748B', bg: '#F1F4F8' };
}
function clasifBox(c: string) {
  const s = clasifStyle(c);
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, borderRadius: 5, padding: '4px 9px', color: s.color, background: s.bg } as const;
}

const CLASIF_LABEL: Record<string, string> = {
  CONFIRMACION_PAGO: 'Confirmación de pago', PROMESA_PAGO: 'Promesa de pago', CONSULTA: 'Consulta',
  RECLAMO: 'Reclamo', NOTA_CREDITO: 'Nota de crédito', OTRO: 'Otro',
};

/** Dify no siempre esta disponible en todos los entornos (requiere credenciales
 * externas). Si el backend no logra clasificar, esta heuristica por palabras
 * clave evita dejar el correo sin ninguna clasificacion visible en la demo,
 * y se persiste de verdad via /corregir (no es solo un efecto visual). */
function clasificacionHeuristica(asunto: string, cuerpo: string): string {
  const texto = `${asunto} ${cuerpo}`.toLowerCase();
  if (/transfere|dep[oó]sit|voucher|abon[eé]|pago realizado|confirmo (el )?pago/.test(texto)) return 'CONFIRMACION_PAGO';
  if (/promet|compromet|ampliaci[oó]n de plazo|pagar[eé] el|me comprometo/.test(texto)) return 'PROMESA_PAGO';
  if (/reclamo|disput|inconformidad|no estoy de acuerdo|error en (la )?factura/.test(texto)) return 'RECLAMO';
  if (/nota de cr[eé]dito/.test(texto)) return 'NOTA_CREDITO';
  if (/consulta|saldo pendiente|estado de cuenta|informaci[oó]n sobre/.test(texto)) return 'CONSULTA';
  return 'OTRO';
}

const ACCION_SUGERIDA: Record<string, string> = {
  CONFIRMACION_PAGO: 'Verificar movimiento bancario',
  PROMESA_PAGO: 'Registrar promesa de pago y hacer seguimiento en la fecha comprometida',
  CONSULTA: 'Responder la consulta del cliente',
  RECLAMO: 'Revisar el caso y coordinar con el analista responsable',
  NOTA_CREDITO: 'Evaluar la nota de crédito solicitada',
  OTRO: 'Revisar manualmente',
};

export default function CobranzasRecaudo() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cartera, setCartera] = useState<CarteraRow[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [riesgoPorCliente, setRiesgoPorCliente] = useState<Map<string, string>>(new Map());

  const [emailSeleccionado, setEmailSeleccionado] = useState<Email | null>(null);
  const [filtroClasificacion, setFiltroClasificacion] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [filtroCopiloto, setFiltroCopiloto] = useState<{ desde: string; hasta: string } | null>(null);

  const [gestionFacturaId, setGestionFacturaId] = useState<string | null>(null);
  const [emailDrawer, setEmailDrawer] = useState<Email | null>(null);
  const [clasificando, setClasificando] = useState(false);
  const [conciliando, setConciliando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = () => {
    api.get<Resumen>('/api/cobranzas/resumen').then(setResumen).catch(() => {});
    api.get<CarteraRow[]>('/api/cobranzas/cartera?limit=200&aging=TODOS').then(setCartera).catch(() => {});
    api.get<Email[]>('/api/cobranzas/emails?limit=50&clasificacion=TODOS').then(setEmails).catch(() => {});
    api.get<Movimiento[]>('/api/recaudo/movimientos?limit=100&estado=TODOS').then(setMovimientos).catch(() => {});
    api.get<{ top_clientes: { cliente_id: string; nivel_riesgo: string }[] }>('/api/bi/riesgo?limit=1500').then((r) => {
      setRiesgoPorCliente(new Map(r.top_clientes.map((t) => [t.cliente_id, t.nivel_riesgo])));
    }).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (emailSeleccionado) {
      const actualizado = emails.find((e) => e.id === emailSeleccionado.id);
      if (actualizado) setEmailSeleccionado(actualizado);
    }
    if (emailDrawer) {
      const actualizado = emails.find((e) => e.id === emailDrawer.id);
      if (actualizado) setEmailDrawer(actualizado);
    }
  }, [emails]);

  const mostrarAviso = (texto: string) => { setAviso(texto); setTimeout(() => setAviso(null), 3500); };

  const facturaDe = (e: Email | null) => (e?.factura_id ? cartera.find((c) => c.factura_id === e.factura_id) : undefined);
  const movimientoDe = (e: Email | null) => {
    const factura = facturaDe(e);
    if (!factura) return undefined;
    return movimientos.find((m) => m.match?.factura_id === factura.factura_id);
  };

  const clasificar = async () => {
    if (!emailSeleccionado) return;
    setClasificando(true);
    try {
      const actualizado = await api.post<Email>(`/api/cobranzas/emails/${emailSeleccionado.id}/clasificar`);
      if (actualizado.clasificacion) {
        mostrarAviso(`El Agente de Cobranzas clasificó el correo como "${CLASIF_LABEL[actualizado.clasificacion] || actualizado.clasificacion}".`);
      } else {
        const heur = clasificacionHeuristica(emailSeleccionado.asunto, emailSeleccionado.cuerpo);
        await api.post(`/api/cobranzas/emails/${emailSeleccionado.id}/corregir`, { clasificacion: heur, usuario: 'heuristica_local' });
        mostrarAviso(`Dify no respondió — clasificado como "${CLASIF_LABEL[heur]}" con la heurística local de respaldo.`);
      }
      cargar();
    } finally {
      setClasificando(false);
    }
  };

  const conciliar = async () => {
    const mov = movimientoDe(emailSeleccionado);
    if (!mov?.match) return;
    setConciliando(true);
    try {
      await api.post(`/api/recaudo/matches/${mov.match.id}/confirmar`, {});
      cargar();
      mostrarAviso('Pago conciliado y aplicado a la factura.');
    } finally {
      setConciliando(false);
    }
  };

  const revisarManualmente = () => {
    if (!emailSeleccionado) return;
    const factura = facturaDe(emailSeleccionado);
    if (factura) setGestionFacturaId(factura.factura_id);
    else setEmailDrawer(emailSeleccionado);
  };

  const emailsFiltrados = filtroCopiloto
    ? emails.filter((e) => {
        const f = facturaDe(e);
        if (!f) return false;
        return f.fecha_vencimiento >= filtroCopiloto.desde && f.fecha_vencimiento <= filtroCopiloto.hasta;
      })
    : emails;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Cobranzas &amp; Recaudo</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Mesa de trabajo del Agente de Cobranzas: comunicaciones, conciliación y copiloto en una sola vista.</div>
      </div>

      <AnimatePresence>{aviso && <Toast texto={aviso} />}</AnimatePresence>
      {filtroCopiloto && (
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11.5, color: colors.blueDark, background: colors.blueBg, border: `1px solid ${colors.blue}`, borderRadius: 7, padding: '6px 11px', cursor: 'pointer', fontWeight: 600 }} onClick={() => setFiltroCopiloto(null)}>
            Filtro del copiloto: vencen entre {fecha(filtroCopiloto.desde)} y {fecha(filtroCopiloto.hasta)} · Quitar ✕
          </span>
        </div>
      )}
      <div style={{
        display: 'grid', gridTemplateColumns: '0.82fr 1.08fr 1fr 1.08fr', gap: 16, alignItems: 'stretch',
        height: 'calc(100vh - 220px)', minHeight: 560,
      }}>
        <ControlColumn resumen={resumen} movimientos={movimientos} emails={emails} />
        <InboxColumn
          emails={emailsFiltrados} cartera={cartera} filtro={filtroClasificacion} onFiltro={setFiltroClasificacion}
          search={search} onSearch={setSearch} selectedId={emailSeleccionado?.id || null} onSelect={setEmailSeleccionado}
        />
        <DetailColumn
          email={emailSeleccionado} factura={facturaDe(emailSeleccionado)} movimiento={movimientoDe(emailSeleccionado)}
          clasificando={clasificando} conciliando={conciliando}
          onClasificar={clasificar} onConciliar={conciliar} onRevisarManual={revisarManualmente}
        />
        <CopilotColumn cartera={cartera} riesgoPorCliente={riesgoPorCliente} onUsarComoFiltro={(desde, hasta) => { setFiltroCopiloto({ desde, hasta }); mostrarAviso('Filtro aplicado a la gestión de cobranza.'); }} />
      </div>

      <GestionDrawer facturaId={gestionFacturaId} onClose={() => setGestionFacturaId(null)} onCambio={cargar} />
      <EmailDrawer email={emailDrawer} cartera={cartera} onClose={() => setEmailDrawer(null)} onCambio={cargar} />
    </div>
  );
}

function Toast({ texto }: { texto: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={motionTokens.default}
      style={{ background: colors.blueBg, border: `1px solid ${colors.blue}`, color: colors.blueDark, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12.5, fontWeight: 600 }}
    >
      {texto}
    </motion.div>
  );
}

function GestionDrawer({ facturaId, onClose, onCambio }: { facturaId: string | null; onClose: () => void; onCambio: () => void }) {
  const [data, setData] = useState<any>(null);
  const [notas, setNotas] = useState('');
  const [montoPromesa, setMontoPromesa] = useState('');
  const [fechaPromesa, setFechaPromesa] = useState('');

  useEffect(() => {
    if (facturaId) api.get(`/api/cobranzas/gestion/${facturaId}`).then(setData).catch(() => setData(null));
    else setData(null);
  }, [facturaId]);

  if (!facturaId) return null;

  return (
    <Drawer open={!!facturaId} onClose={onClose} width={440} title="Gestionar caso" subtitle={data && <div style={{ ...monoFont, fontSize: 12.5, color: colors.textMuted }}>{data.cliente?.razon_social}</div>}
      footer={(
        <button onClick={async () => { await api.post(`/api/cobranzas/gestiones/${facturaId}`, { notas }); onCambio(); onClose(); }} style={{ height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Guardar gestión</button>
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
          <Section title="LÍNEA DE TIEMPO">
            <CuentaTimeline data={data} />
          </Section>
          {data.ultimo_email && (
            <Section title="ÚLTIMO CORREO">
              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 11.5, color: colors.textFaint, marginBottom: 6 }}>{fechaHora(data.ultimo_email.recibido_at)}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong, marginBottom: 6 }}>{data.ultimo_email.asunto}</div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>{data.ultimo_email.cuerpo}</div>
                {data.ultimo_email.clasificacion && <span style={{ ...clasifBox(data.ultimo_email.clasificacion), marginTop: 10, display: 'inline-block' }}>{data.ultimo_email.clasificacion}</span>}
              </div>
            </Section>
          )}
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

function EmailDrawer({ email, cartera, onClose, onCambio }: { email: Email | null; cartera: CarteraRow[]; onClose: () => void; onCambio: () => void }) {
  const [clasificando, setClasificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => { setAviso(null); }, [email?.id]);
  if (!email) return null;
  const clasificar = async () => {
    setClasificando(true);
    setAviso(null);
    try {
      const actualizado = await api.post<Email>(`/api/cobranzas/emails/${email.id}/clasificar`);
      if (actualizado.clasificacion) {
        setAviso(`El Agente de Cobranzas clasificó el correo como "${CLASIF_LABEL[actualizado.clasificacion] || actualizado.clasificacion}".`);
      } else {
        const heur = clasificacionHeuristica(email.asunto, email.cuerpo);
        await api.post(`/api/cobranzas/emails/${email.id}/corregir`, { clasificacion: heur, usuario: 'heuristica_local' });
        setAviso(`Dify no respondió — clasificado como "${CLASIF_LABEL[heur]}" con la heurística local de respaldo.`);
      }
      onCambio();
    } finally {
      setClasificando(false);
    }
  };
  const facturaRelacionada = email.factura_id ? cartera.find((c) => c.factura_id === email.factura_id) : undefined;

  return (
    <Drawer open={!!email} onClose={onClose} width={440} title={email.asunto} subtitle={<span style={{ ...monoFont, fontSize: 12.5, color: colors.textMuted }}>{email.cliente_nombre}</span>}
      footer={(
        <>
          {!email.clasificacion && <button onClick={clasificar} disabled={clasificando} style={{ height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{clasificando ? 'Clasificando…' : 'Clasificar con IA'}</button>}
          <button onClick={onClose} style={btnLight}>Cerrar</button>
        </>
      )}>
      {aviso && (
        <div style={{ background: colors.blueBg, border: `1px solid ${colors.blue}`, borderRadius: 8, padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: colors.blueDark, marginBottom: 18 }}>
          {aviso}
        </div>
      )}
      <Section title="CORREO ORIGINAL">
        <div style={{ fontSize: 11.5, color: colors.textFaint, marginBottom: 10 }}>{fechaHora(email.recibido_at)}</div>
        <div style={{ fontSize: 13.5, color: colors.text, lineHeight: 1.6 }}>{email.cuerpo}</div>
        {email.adjuntos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {email.adjuntos.map((a, i) => <span key={i} style={{ ...monoFont, fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '6px 10px' }}>{a.nombre}</span>)}
          </div>
        )}
      </Section>

      <Section title="INTERPRETACIÓN DE TRAZA">
        {email.clasificacion ? (
          <InfoBox rows={[
            ['Tipo', email.clasificacion, false],
            ...(email.confianza != null ? [['Confianza', `${(email.confianza * 100).toFixed(0)}%`, false] as [string, any, boolean]] : []),
            ['Fecha', fecha(email.recibido_at), false],
            ['Factura relacionada', facturaRelacionada?.numero || (email.factura_id ? 'Detectada' : 'No detectada'), true],
            ['Acción sugerida', ACCION_SUGERIDA[email.clasificacion] || 'Revisar manualmente', false],
          ]} />
        ) : (
          <div style={{ background: colors.amberBg, borderRadius: 8, padding: '14px 16px', fontSize: 13, color: colors.amberDark, fontWeight: 600 }}>Pendiente de clasificación.</div>
        )}
      </Section>
    </Drawer>
  );
}

type PuntoTimeline = { date: string | null; label: string; detail?: string; pendiente?: boolean };

function CuentaTimeline({ data }: { data: any }) {
  const puntos: PuntoTimeline[] = [];
  if (data.factura?.fecha_emision) puntos.push({ date: data.factura.fecha_emision, label: 'Factura emitida', detail: data.factura.numero });
  if (data.gestion?.created_at) puntos.push({ date: data.gestion.created_at, label: 'Gestión de cobranza iniciada', detail: data.gestion.prioridad ? `Prioridad ${data.gestion.prioridad}` : undefined });
  if (data.ultimo_email?.recibido_at) puntos.push({ date: data.ultimo_email.recibido_at, label: 'Cliente respondió', detail: data.ultimo_email.clasificacion ? `TRAZA clasificó: ${data.ultimo_email.clasificacion}` : 'Pendiente de clasificar' });

  puntos.sort((a, b) => (a.date && b.date ? new Date(a.date).getTime() - new Date(b.date).getTime() : 0));

  const clasif = data.ultimo_email?.clasificacion;
  if (clasif === 'CONFIRMACION_PAGO') {
    puntos.push({ date: null, label: 'Pendiente de conciliar en Recaudo', pendiente: true });
  } else if (data.gestion?.fecha_proxima_accion) {
    puntos.push({ date: null, label: `Próxima acción: ${fecha(data.gestion.fecha_proxima_accion)}`, pendiente: true });
  }

  if (puntos.length === 0) return <div style={{ fontSize: 13, color: colors.textFaint }}>Sin eventos registrados aún para esta cuenta.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {puntos.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.pendiente ? '#fff' : colors.blue, border: p.pendiente ? `1.5px solid ${colors.textFaint}` : 'none', flexShrink: 0 }} />
            {i < puntos.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 22, background: colors.border }} />}
          </div>
          <div style={{ paddingBottom: 16 }}>
            <div style={{ fontSize: 11.5, color: colors.textFaint }}>{p.date ? fechaHora(p.date) : '—'}</div>
            <div style={{ fontSize: 13, color: p.pendiente ? colors.textMuted : colors.text, fontStyle: p.pendiente ? 'italic' : 'normal' }}>{p.label}</div>
            {p.detail && <div style={{ ...monoFont, fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{p.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
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
const inputStyle: React.CSSProperties = { height: 36, flex: 1, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const btnDark: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnLight: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
