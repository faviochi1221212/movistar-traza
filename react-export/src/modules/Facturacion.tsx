import { useEffect, useState } from 'react';
import { colors, monoFont, priorityStyle, tabStyle } from '../lib/styles';
import { api, fecha, fechaHora, money } from '../lib/api';
import Drawer from '../components/Drawer';

type Resumen = {
  validacion: { correctas: number; en_revision: number; total: number };
  conformidad: { pendientes: number };
  emision: { emitidas: number; monto_emitido: number };
  control: { casos_abiertos: number; casos_criticos: number };
};

type Caso = {
  id: string; codigo: string; prioridad: 'ALTA' | 'MEDIA' | 'BAJA' | 'CRITICA';
  cliente_nombre: string | null; factura_numero: string | null; factura_id: string | null;
  tipo_caso: string; asunto: string; descripcion: string | null;
  impacto_monto: number | null; estado: string;
};

type Validacion = {
  id: string; cliente_nombre: string | null; tipo_validacion: string; resultado: string;
  observacion: string | null; created_at: string;
};

type Emision = {
  id: string; numero: string; cliente_nombre: string | null; tipo_factura: string;
  estado: string; conformidad_estado: string; monto: number; puede_emitir: boolean; motivo: string;
};

const TABS = [
  { id: 'resumen', label: 'Resumen del ciclo' },
  { id: 'validaciones', label: 'Validaciones' },
  { id: 'casos', label: 'Casos detectados' },
  { id: 'emision', label: 'Emisión' },
] as const;
type TabId = typeof TABS[number]['id'] | 'conformidad';

const PRIORIDAD_UI: Record<string, 'Alta' | 'Media' | 'Baja'> = { CRITICA: 'Alta', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };

function resultadoStyle(r: string) {
  return r === 'CORRECTO' ? { color: colors.greenDark, bg: colors.greenBg } : { color: colors.amberDark, bg: colors.amberBg };
}
function tagBox(s: { color: string; bg: string }) {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 5, padding: '4px 9px' } as const;
}

export default function Facturacion() {
  const [tab, setTab] = useState<TabId>('resumen');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [validaciones, setValidaciones] = useState<Validacion[]>([]);
  const [emision, setEmision] = useState<Emision[]>([]);
  const [drawerCaso, setDrawerCaso] = useState<Caso | null>(null);
  const [conformidadFacturaId, setConformidadFacturaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Resumen>('/api/facturacion/resumen'),
      api.get<Caso[]>('/api/facturacion/casos'),
      api.get<Validacion[]>('/api/facturacion/validaciones?limit=100'),
      api.get<Emision[]>('/api/facturacion/emision'),
    ])
      .then(([r, c, v, e]) => { setResumen(r); setCasos(c); setValidaciones(v); setEmision(e); })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, []);

  const onReview = (c: Caso) => {
    if (c.factura_id) { setConformidadFacturaId(c.factura_id); setTab('conformidad'); }
    else setDrawerCaso(c);
  };

  const emitir = async (id: string) => {
    await api.post(`/api/facturacion/facturas/${id}/emitir`);
    cargar();
  };

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Facturación</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Detecta inconsistencias, anomalías y posibles omisiones en el ciclo de facturación.</div>
        </div>
        <button onClick={() => api.post('/api/facturacion/procesar-lote').then(cargar)} style={btnLight}>Ejecutar validaciones</button>
      </div>

      {error && <div style={{ ...tagBox({ color: colors.redDark, bg: colors.redBg }), marginBottom: 16 }}>Error cargando datos: {error}</div>}

      <div style={{ display: 'flex', gap: 26, borderBottom: `1px solid ${colors.border}`, marginBottom: 24 }}>
        {TABS.map((t) => (
          <div key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {loading && !resumen && <div style={{ color: colors.textMuted, fontSize: 13 }}>Cargando…</div>}

      {tab === 'resumen' && resumen && (
        <div>
          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong, marginBottom: 16 }}>Estado del ciclo</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div onClick={() => setTab('validaciones')} style={{ cursor: 'pointer', background: colors.greenBg, borderRadius: '8px 0 0 8px', padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 8 }}>1</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 8 }}>Validación</div>
                  <div style={{ fontSize: 13, color: colors.text }}>{resumen.validacion.correctas} correctas</div>
                  <div style={{ fontSize: 12.5, color: colors.greenDark, fontWeight: 600, marginTop: 2 }}>{resumen.validacion.en_revision} en revisión</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: `1.5px solid ${colors.green}`, color: colors.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>✓</div>
              </div>
              <div onClick={() => setTab('casos')} style={{ cursor: 'pointer', background: colors.amberBg, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 8 }}>2</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 8 }}>Casos detectados</div>
                  <div style={{ fontSize: 13, color: colors.text }}>{resumen.control.casos_abiertos} casos abiertos</div>
                  <div style={{ fontSize: 12.5, color: colors.amberDark, fontWeight: 600, marginTop: 2 }}>Requieren atención</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: `1.5px solid ${colors.amber}`, color: colors.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>!</div>
              </div>
              <div onClick={() => setTab('emision')} style={{ cursor: 'pointer', background: colors.greenBg, borderRadius: '0 8px 8px 0', padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 8 }}>3</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 8 }}>Emisión</div>
                  <div style={{ fontSize: 13, color: colors.text }}>{resumen.emision.emitidas} emitidas</div>
                  <div style={{ fontSize: 12.5, color: colors.greenDark, fontWeight: 600, marginTop: 2 }}>{money(resumen.emision.monto_emitido)}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: `1.5px solid ${colors.green}`, color: colors.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 14, height: 14, border: '1.6px solid currentColor', borderRadius: 2 }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Casos que requieren atención</div>
              <span style={tagBox({ color: colors.redDark, bg: colors.redBg })}>{resumen.control.casos_criticos} críticos</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={th('left', 20)}>PRIORIDAD</th>
                  <th style={th('left')}>CLIENTE</th>
                  <th style={th('left')}>ASUNTO</th>
                  <th style={th('right')}>IMPACTO (S/)</th>
                  <th style={th('right', 20)}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {casos.slice(0, 8).map((c) => (
                  <tr key={c.id} style={{ height: 46 }}>
                    <td style={td(20)}><span style={priorityStyle(PRIORIDAD_UI[c.prioridad] || 'Media')}>{PRIORIDAD_UI[c.prioridad] || c.prioridad}</span></td>
                    <td style={{ ...td(), ...monoFont, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{c.cliente_nombre || '—'}</td>
                    <td style={{ ...td(), fontSize: 13, color: colors.text }}>{c.asunto}</td>
                    <td style={{ ...td(), fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right', whiteSpace: 'nowrap' }}>{c.impacto_monto != null ? money(c.impacto_monto) : '—'}</td>
                    <td style={{ ...td(20), textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => onReview(c)} style={btnGhost}>Revisar caso</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'validaciones' && (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>CLIENTE</th>
                <th style={th('left')}>TIPO DE VALIDACIÓN</th>
                <th style={th('left')}>FECHA</th>
                <th style={th('left')}>RESULTADO</th>
                <th style={th('left', 20)}>OBSERVACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {validaciones.map((v) => (
                <tr key={v.id}>
                  <td style={{ ...td(20), ...monoFont, fontSize: 13, fontWeight: 600, color: colors.textStrong, padding: '14px 20px' }}>{v.cliente_nombre || '—'}</td>
                  <td style={{ ...td(), fontSize: 13, color: colors.text, padding: '14px 12px' }}>{v.tipo_validacion}</td>
                  <td style={{ ...td(), fontSize: 13, color: colors.text, padding: '14px 12px' }}>{fecha(v.created_at)}</td>
                  <td style={{ ...td(), padding: '14px 12px' }}><span style={tagBox(resultadoStyle(v.resultado))}>{v.resultado}</span></td>
                  <td style={{ ...td(20), fontSize: 13, color: colors.textMuted, padding: '14px 20px' }}>{v.observacion || 'Sin observaciones'}</td>
                </tr>
              ))}
              {validaciones.length === 0 && <tr><td style={{ padding: 20, color: colors.textFaint, fontSize: 13 }} colSpan={5}>Aún no se han ejecutado validaciones. Usa "Ejecutar validaciones".</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'casos' && (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Casos pendientes de revisión ({casos.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={th('left', 20)}>PRIORIDAD</th>
                <th style={th('left')}>CLIENTE</th>
                <th style={th('left')}>CASO DETECTADO</th>
                <th style={th('right')}>IMPACTO</th>
                <th style={th('left')}>ESTADO</th>
                <th style={th('right', 20)}></th>
              </tr>
            </thead>
            <tbody>
              {casos.slice(0, 60).map((c) => (
                <tr key={c.id} style={{ height: 46 }}>
                  <td style={td(20)}><span style={priorityStyle(PRIORIDAD_UI[c.prioridad] || 'Media')}>{PRIORIDAD_UI[c.prioridad] || c.prioridad}</span></td>
                  <td style={{ ...td(), ...monoFont, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{c.cliente_nombre || '—'}</td>
                  <td style={{ ...td(), fontSize: 13, color: colors.text }}>{c.asunto}</td>
                  <td style={{ ...td(), fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right', whiteSpace: 'nowrap' }}>{c.impacto_monto != null ? money(c.impacto_monto) : '—'}</td>
                  <td style={td()}><span style={tagBox({ color: colors.amberDark, bg: colors.amberBg })}>{c.estado}</span></td>
                  <td style={{ ...td(20), textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => onReview(c)} style={btnGhost}>Revisar caso</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'conformidad' && conformidadFacturaId && (
        <ConformidadScreen facturaId={conformidadFacturaId} onVolver={() => setTab('casos')} onCambio={cargar} />
      )}

      {tab === 'emision' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
            <KpiIcon label="Cíclicas listas para emitir" value={emision.filter((e) => e.tipo_factura === 'CICLICA' && e.puede_emitir).length} bg={colors.greenBg} border={colors.green} />
            <KpiIcon label="Acíclicas aprobadas" value={emision.filter((e) => e.tipo_factura === 'ACICLICA' && e.puede_emitir).length} bg={colors.blueBg} border={colors.blue} />
            <KpiIcon label="Bloqueadas" value={emision.filter((e) => !e.puede_emitir).length} bg={colors.redBg} border={colors.red} />
          </div>

          <div style={{ background: colors.blueBg, border: '1px solid #D6E6FB', borderRadius: 9, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
            Las facturas cíclicas no requieren conformidad.<br />Las facturas acíclicas requieren conformidad aprobada antes de emitir.
          </div>

          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Facturas en proceso ({emision.length})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={th('left', 20)}>CLIENTE</th>
                  <th style={th('left')}>DOCUMENTO</th>
                  <th style={th('left')}>TIPO FACTURA</th>
                  <th style={th('left')}>CONFORMIDAD</th>
                  <th style={th('right')}>MONTO</th>
                  <th style={th('right', 20)}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {emision.map((e) => (
                  <tr key={e.id}>
                    <td style={{ ...monoFont, padding: '14px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{e.cliente_nombre}</td>
                    <td style={{ ...monoFont, padding: '14px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{e.numero}</td>
                    <td style={{ padding: '14px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={tagBox(e.tipo_factura === 'CICLICA' ? { color: colors.greenDark, bg: colors.greenBg } : { color: colors.blueDark, bg: colors.blueBg })}>{e.tipo_factura === 'CICLICA' ? 'Cíclica' : 'Acíclica'}</span></td>
                    <td style={{ padding: '14px 12px', borderBottom: `1px solid ${colors.borderLight}` }}>
                      <span style={tagBox(e.conformidad_estado === 'APROBADO' ? { color: colors.greenDark, bg: colors.greenBg } : e.conformidad_estado === 'NO_APLICA' ? { color: '#475467', bg: '#F1F4F8' } : { color: colors.amberDark, bg: colors.amberBg })}>{e.conformidad_estado}</span>
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(e.monto)}</td>
                    <td style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {e.puede_emitir
                        ? <button onClick={() => emitir(e.id)} style={btnDark}>Emitir</button>
                        : <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, color: colors.redDark, background: colors.redBg, borderRadius: 6, padding: '6px 12px' }} title={e.motivo}>Bloqueada</span>}
                    </td>
                  </tr>
                ))}
                {emision.length === 0 && <tr><td style={{ padding: 20, color: colors.textFaint, fontSize: 13 }} colSpan={6}>No hay facturas en proceso de emisión en este momento.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Drawer
        open={!!drawerCaso}
        onClose={() => setDrawerCaso(null)}
        title={drawerCaso?.asunto}
        subtitle={drawerCaso && (
          <>
            <span style={{ ...tagBox({ color: colors.amberDark, bg: colors.amberBg }), marginTop: 10, display: 'inline-block' }}>{drawerCaso.estado}</span>
            <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
              <div><div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted }}>CLIENTE</div><div style={{ ...monoFont, fontSize: 13, fontWeight: 600, color: colors.textStrong, marginTop: 2 }}>{drawerCaso.cliente_nombre}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted }}>TIPO</div><div style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, marginTop: 2 }}>{drawerCaso.tipo_caso}</div></div>
            </div>
          </>
        )}
        footer={drawerCaso && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={async () => { await api.post(`/api/facturacion/casos/${drawerCaso.id}/resolver`, { accion: 'CREAR_TAREA' }); setDrawerCaso(null); cargar(); }} style={{ ...btnDark, flex: 1 }}>Crear tarea operativa</button>
            <button onClick={async () => { await api.post(`/api/facturacion/casos/${drawerCaso.id}/resolver`, { accion: 'DESCARTAR' }); setDrawerCaso(null); cargar(); }} style={{ ...btnLight, flex: 1 }}>Descartar</button>
          </div>
        )}
      >
        {drawerCaso && (
          <div style={{ background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
            {drawerCaso.descripcion || 'Sin detalle adicional registrado por el agente de Facturación.'}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function ConformidadScreen({ facturaId, onVolver, onCambio }: { facturaId: string; onVolver: () => void; onCambio: () => void }) {
  const [data, setData] = useState<any>(null);
  const [respuesta, setRespuesta] = useState('');

  const cargar = () => api.get(`/api/facturacion/conformidades/${facturaId}`).then(setData).catch(() => setData(null));
  useEffect(() => { cargar(); }, [facturaId]);

  if (!data) return <div style={{ fontSize: 13, color: colors.textMuted }}>Esta factura no tiene una solicitud de conformidad activa.</div>;

  const estadoTag: Record<string, { color: string; bg: string }> = {
    PENDIENTE: { color: colors.amberDark, bg: colors.amberBg },
    APROBADO: { color: colors.greenDark, bg: colors.greenBg },
    OBSERVADO: { color: colors.amberDark, bg: colors.amberBg },
    SIN_RESPUESTA: { color: colors.redDark, bg: colors.redBg },
  };

  return (
    <div>
      <div onClick={onVolver} style={{ fontSize: 12.5, color: colors.blueDark, cursor: 'pointer', marginBottom: 16 }}>← Volver a casos</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: colors.textStrong }}>Conformidad del cliente</div>
          <div style={{ ...monoFont, fontSize: 13, color: colors.textMuted, marginTop: 4 }}>{data.factura_numero} · {data.cliente_nombre}</div>
        </div>
        <span style={tagBox(estadoTag[data.estado] || estadoTag.PENDIENTE)}>{data.estado}</span>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong, marginBottom: 16 }}>Historial de eventos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(data.eventos || []).map((ev: any) => (
            <div key={ev.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.blue, marginTop: 5, flexShrink: 0 }} />
              <div><div style={{ fontSize: 11.5, color: colors.textFaint }}>{fechaHora(ev.created_at)}</div><div style={{ fontSize: 13, color: colors.text }}>{ev.tipo_evento}{ev.detalle ? ` — ${ev.detalle}` : ''}</div></div>
            </div>
          ))}
          {(!data.eventos || data.eventos.length === 0) && <div style={{ fontSize: 13, color: colors.textFaint }}>Sin eventos registrados aún.</div>}
        </div>
      </div>

      {data.estado === 'PENDIENTE' || data.estado === 'SIN_RESPUESTA' ? (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textStrong, marginBottom: 12 }}>Registrar respuesta del cliente</div>
          <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Pega o transcribe la respuesta del cliente (ej: 'Aprobado, conforme con la factura')..."
            style={{ width: '100%', minHeight: 70, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={async () => { await api.post(`/api/facturacion/conformidades/${data.id}/respuesta`, { respuesta }); setRespuesta(''); cargar(); onCambio(); }} style={btnDark}>Registrar respuesta</button>
            <button onClick={async () => { await api.post(`/api/facturacion/conformidades/${data.id}/recordatorio`); cargar(); }} style={btnLight}>Enviar recordatorio</button>
          </div>
        </div>
      ) : (
        <div style={{ background: colors.blueBg, borderRadius: 8, padding: '14px 16px', fontSize: 13.5, color: colors.text }}>
          {data.respuesta_cliente || 'Respuesta registrada.'}
        </div>
      )}
    </div>
  );
}

function KpiIcon({ label, value, bg, border }: { label: string; value: number; bg: string; border: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${border}` }} />
      </div>
      <div><div style={{ fontSize: 13.5, color: colors.textStrong, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 26, fontWeight: 700, color: colors.textStrong }}>{value}</div></div>
    </div>
  );
}

function th(align: 'left' | 'right', pad = 12): React.CSSProperties {
  return { textAlign: align, fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: 0.4, padding: `10px ${pad}px`, borderBottom: `1px solid ${colors.border}` };
}
function td(pad = 12): React.CSSProperties {
  return { padding: `0 ${pad}px`, borderBottom: `1px solid ${colors.borderLight}` };
}

const btnDark: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnLight: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { height: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
