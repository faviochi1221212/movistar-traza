import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { colors, monoFont, priorityStyle } from '../lib/styles';
import { api, fecha, fechaHora, money } from '../lib/api';
import Drawer from '../components/Drawer';
import FilterSelect from '../components/FilterSelect';
import { motionTokens, prefersReducedMotion } from '../lib/motionTokens';
import EmisionYConsulta from '../components/facturacion/EmisionYConsulta';

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
  impacto_monto: number | null; estado: string; factura_fuente: string | null;
};

type Comunicacion = {
  id: string; cliente_nombre: string | null; factura_numero: string | null;
  clasificacion: string; asunto: string; recibido_at: string;
};

type FacturaAmplia = {
  id: string; numero: string; cliente_nombre: string | null; monto: number; tipo_factura: string;
  estado: string; fecha_emision: string; fecha_vencimiento: string; fuente: string | null;
};

type Validacion = {
  id: string; cliente_nombre: string | null; tipo_validacion: string; resultado: string;
  observacion: string | null; created_at: string; factura_id: string | null; factura_numero: string | null;
};

type FacturaDetalle = {
  id: string; numero: string; cliente_nombre: string | null; tipo_factura: string; estado: string;
  moneda: string; monto: number; monto_neto: number; igv: number; fecha_emision: string; fecha_vencimiento: string;
  conformidad_estado: string;
  validaciones: { id: string; tipo_validacion: string; resultado: string; observacion: string | null }[];
};

type Emision = {
  id: string; numero: string; cliente_nombre: string | null; tipo_factura: string;
  estado: string; conformidad_estado: string; monto: number; puede_emitir: boolean; motivo: string; fuente: string | null;
};

type Vista = 'grid' | 'conformidad';

const PRIORIDAD_UI: Record<string, 'Alta' | 'Media' | 'Baja'> = { CRITICA: 'Alta', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };

function resultadoStyle(r: string) {
  return r === 'CORRECTO' ? { color: colors.greenDark, bg: colors.greenBg } : { color: colors.amberDark, bg: colors.amberBg };
}
function tagBox(s: { color: string; bg: string }) {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 5, padding: '4px 9px' } as const;
}

export default function Facturacion() {
  const [vista, setVista] = useState<Vista>('grid');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [validaciones, setValidaciones] = useState<Validacion[]>([]);
  const [emision, setEmision] = useState<Emision[]>([]);
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([]);
  const [casosTodos, setCasosTodos] = useState<Caso[]>([]);
  const [validacionesTodas, setValidacionesTodas] = useState<Validacion[]>([]);
  const [facturasTodas, setFacturasTodas] = useState<FacturaAmplia[]>([]);
  const [drawerCaso, setDrawerCaso] = useState<Caso | null>(null);
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaDetalle | null>(null);
  const [facturaDetalleLoading, setFacturaDetalleLoading] = useState(false);
  const [conformidadFacturaId, setConformidadFacturaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filtroResultado, setFiltroResultado] = useState('TODOS');
  const [filtroEstadoCaso, setFiltroEstadoCaso] = useState('TODOS');
  const [filtroTipoFactura, setFiltroTipoFactura] = useState('TODOS');

  const [consolidando, setConsolidando] = useState(false);
  const [handoff, setHandoff] = useState<{ numero: string; monto: number } | null>(null);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'green' | 'amber'; texto: string } | null>(null);
  const esPrimeraCarga = useRef(true);
  const refValidaciones = useRef<HTMLDivElement>(null);
  const refCasos = useRef<HTMLDivElement>(null);
  const refEmision = useRef<HTMLDivElement>(null);
  const [destacado, setDestacado] = useState<'validaciones' | 'casos' | 'emision' | null>(null);

  const irA = (destino: 'validaciones' | 'casos' | 'emision') => {
    const ref = destino === 'validaciones' ? refValidaciones : destino === 'casos' ? refCasos : refEmision;
    ref.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    setDestacado(destino);
    setTimeout(() => setDestacado(null), 1400);
  };

  const mostrarConsolidacion = () => {
    if (prefersReducedMotion()) return;
    setConsolidando(true);
    setTimeout(() => setConsolidando(false), 1500);
  };

  const cargar = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Resumen>('/api/facturacion/resumen'),
      api.get<Caso[]>(`/api/facturacion/casos?estado=${filtroEstadoCaso}`),
      api.get<Validacion[]>(`/api/facturacion/validaciones?limit=300&resultado=${filtroResultado}`),
      api.get<Emision[]>(`/api/facturacion/emision?tipo_factura=${filtroTipoFactura}`),
    ])
      .then(([r, c, v, e]) => { setResumen(r); setCasos(c); setValidaciones(v); setEmision(e); })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));

    // Datos del asistente de Facturación: se cargan aparte, sin bloquear ni
    // mostrar el banner de error si fallan (no son criticos para el resto de
    // la pantalla, y sumarlos al Promise.all de arriba disparaba el error
    // general con solo una de las 7 llamadas fallando bajo carga concurrente).
    api.get<Caso[]>('/api/facturacion/casos?estado=TODOS&limit=300').then(setCasosTodos).catch(() => {});
    api.get<Validacion[]>('/api/facturacion/validaciones?limit=300&resultado=TODOS').then(setValidacionesTodas).catch(() => {});
    api.get<Comunicacion[]>('/api/facturacion/comunicaciones').then(setComunicaciones).catch(() => {});
    api.get<FacturaAmplia[]>('/api/facturacion/facturas?limit=3000').then(setFacturasTodas).catch(() => {});
  };

  useEffect(() => {
    cargar();
    if (esPrimeraCarga.current) { esPrimeraCarga.current = false; mostrarConsolidacion(); }
  }, [filtroResultado, filtroEstadoCaso, filtroTipoFactura]);

  const ejecutarValidaciones = () => {
    mostrarConsolidacion();
    api.post('/api/facturacion/procesar-lote').then(cargar);
  };

  const onReview = (c: Caso) => setDrawerCaso(c);

  const emitir = async (id: string) => {
    const f = emision.find((e) => e.id === id);
    try {
      await api.post(`/api/facturacion/facturas/${id}/emitir`);
    } catch (err) {
      setError(String(err));
      return;
    }
    if (f) {
      setHandoff({ numero: f.numero, monto: f.monto });
      setTimeout(() => setHandoff(null), prefersReducedMotion() ? 2200 : 3600);
    }
    cargar();
  };

  const mostrarAviso = (tono: 'green' | 'amber', texto: string) => {
    setAviso({ tono, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  const verFactura = (facturaId: string) => {
    setFacturaDetalleLoading(true);
    setFacturaDetalle(null);
    api.get<FacturaDetalle>(`/api/facturacion/facturas/${facturaId}`)
      .then(setFacturaDetalle)
      .catch((err) => setError(String(err)))
      .finally(() => setFacturaDetalleLoading(false));
  };

  if (vista === 'conformidad' && conformidadFacturaId) {
    return (
      <div>
        <ConformidadScreen facturaId={conformidadFacturaId} onVolver={() => setVista('grid')} onCambio={cargar} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Facturación</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Detecta inconsistencias, anomalías y posibles omisiones en el ciclo de facturación.</div>
        </div>
        <button onClick={ejecutarValidaciones} style={btnLight}>Ejecutar validaciones</button>
      </div>

      {error && (
        <div style={{ background: colors.redBg, border: '1px solid #F8C9C9', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.redDark }}>No pudimos completar la operación</div>
          <div style={{ fontSize: 12.5, color: colors.text, marginTop: 3 }}>El backend no respondió a tiempo o la base de datos no está disponible. Intenta de nuevo en unos segundos.</div>
          <div style={{ ...monoFont, fontSize: 11, color: colors.textFaint, marginTop: 6 }}>{error}</div>
        </div>
      )}

      {consolidando && <ConsolidationIntro total={resumen?.validacion.total} />}
      <AnimatePresence>{handoff && <EmisionHandoff numero={handoff.numero} monto={handoff.monto} />}</AnimatePresence>
      <AnimatePresence>{aviso && <Aviso tono={aviso.tono} texto={aviso.texto} />}</AnimatePresence>

      {loading && !resumen && <div style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>Cargando…</div>}

      {crearAbierto ? (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 24 }}>
          <CrearFacturaDesdeCorreo
            onVolver={() => setCrearAbierto(false)}
            onPreparada={() => { setCrearAbierto(false); mostrarAviso('green', 'Factura preparada para revisión.'); cargar(); setTimeout(() => irA('validaciones'), 150); }}
            onCasoDetectado={() => { setCrearAbierto(false); mostrarAviso('amber', 'Caso enviado a revisión. Revísalo en "Casos detectados".'); }}
          />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))',
            gap: 16,
            alignItems: 'start',
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          <ColumnaCrear resumen={resumen} emision={emision} onCrear={() => setCrearAbierto(true)} onIrA={irA} />

          <div ref={refValidaciones} style={{ borderRadius: 10, transition: 'box-shadow 200ms', boxShadow: destacado === 'validaciones' ? `0 0 0 3px ${colors.blue}55` : 'none' }}>
          <ColumnaCard titulo="Validaciones">
            <div style={{ marginBottom: 12 }}>
              <FilterSelect label="Resultado" value={filtroResultado} onChange={setFiltroResultado} options={[
                { value: 'TODOS', label: 'Todos' }, { value: 'CORRECTO', label: 'Correcto' },
                { value: 'OBSERVACION', label: 'Observación' }, { value: 'ERROR', label: 'Error' },
              ]} />
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={th('left', 12)}>CLIENTE</th>
                    <th style={th('left')}>RESULTADO</th>
                    <th style={th('left', 12)}>FECHA</th>
                  </tr>
                </thead>
                <tbody>
                  {validaciones.map((v) => (
                    <tr key={v.id} title={v.observacion || undefined}>
                      <td style={{ ...td(12), padding: '10px 12px' }}>
                        {v.factura_id ? (
                          <span
                            onClick={() => verFactura(v.factura_id!)}
                            style={{ ...monoFont, fontSize: 12.5, fontWeight: 600, color: colors.blueDark, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                            title={v.factura_numero ? `Ver factura ${v.factura_numero}` : 'Ver factura'}
                          >
                            {v.cliente_nombre || '—'}
                          </span>
                        ) : (
                          <span style={{ ...monoFont, fontSize: 12.5, fontWeight: 600, color: colors.textStrong }}>{v.cliente_nombre || '—'}</span>
                        )}
                      </td>
                      <td style={{ ...td(), padding: '10px 8px' }}><span style={tagBox(resultadoStyle(v.resultado))}>{v.resultado}</span></td>
                      <td style={{ ...td(12), fontSize: 12, color: colors.textMuted, padding: '10px 12px', whiteSpace: 'nowrap' }}>{fecha(v.created_at)}</td>
                    </tr>
                  ))}
                  {validaciones.length === 0 && (
                    <tr><td style={{ padding: '20px 16px', textAlign: 'center' }} colSpan={3}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.textStrong }}>Aún no hay validaciones</div>
                      <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 4 }}>El Agente de Facturación todavía no procesó documentos en este ciclo.</div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </ColumnaCard>
          </div>

          <div ref={refCasos} style={{ borderRadius: 10, transition: 'box-shadow 200ms', boxShadow: destacado === 'casos' ? `0 0 0 3px ${colors.amber}55` : 'none' }}>
          <ColumnaCard titulo="Casos detectados" badge={resumen ? `${resumen.control.casos_criticos} críticos` : undefined}>
            <div style={{ marginBottom: 12 }}>
              <FilterSelect label="Estado" value={filtroEstadoCaso} onChange={setFiltroEstadoCaso} options={[
                { value: 'TODOS', label: 'Abiertos y en revisión' }, { value: 'ABIERTO', label: 'Abierto' },
                { value: 'EN_REVISION', label: 'En revisión' }, { value: 'RESUELTO', label: 'Resuelto' },
                { value: 'DESCARTADO', label: 'Descartado' },
              ]} />
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {casos.slice(0, 60).map((c) => (
                <div key={c.id} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={priorityStyle(PRIORIDAD_UI[c.prioridad] || 'Media')}>{PRIORIDAD_UI[c.prioridad] || c.prioridad}</span>
                    {c.impacto_monto != null && <span style={{ fontSize: 12, fontWeight: 700, color: colors.textStrong, whiteSpace: 'nowrap' }}>{money(c.impacto_monto)}</span>}
                  </div>
                  <div style={{ ...monoFont, fontSize: 12, fontWeight: 600, color: colors.textStrong, marginTop: 6 }}>{c.cliente_nombre || '—'}</div>
                  <div style={{ fontSize: 12, color: colors.text, marginTop: 2 }}>{c.asunto}</div>
                  <button onClick={() => onReview(c)} style={{ ...btnGhost, marginTop: 8, width: '100%' }}>Revisar caso</button>
                </div>
              ))}
              {casos.length === 0 && (
                <div style={{ padding: '20px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textStrong }}>No hay casos pendientes de revisión</div>
                  <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 4 }}>El Agente de Facturación no ha detectado excepciones abiertas.</div>
                </div>
              )}
            </div>
          </ColumnaCard>
          </div>

          <div ref={refEmision} style={{ borderRadius: 10, transition: 'box-shadow 200ms', boxShadow: destacado === 'emision' ? `0 0 0 3px ${colors.green}55` : 'none' }}>
          <EmisionYConsulta
            emision={emision} filtroTipoFactura={filtroTipoFactura} onFiltro={setFiltroTipoFactura} onEmitir={emitir}
            contexto={{ resumen, casos: casosTodos, validaciones: validacionesTodas, emision, comunicaciones, facturasTodas }}
          />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drawerCaso.factura_id && (
              <button onClick={() => { const id = drawerCaso.factura_id!; setDrawerCaso(null); setConformidadFacturaId(id); setVista('conformidad'); }} style={btnLight}>Ver conformidad de la factura</button>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={async () => { await api.post(`/api/facturacion/casos/${drawerCaso.id}/resolver`, { accion: 'CREAR_TAREA' }); setDrawerCaso(null); cargar(); }} style={{ ...btnDark, flex: 1 }}>Crear tarea operativa</button>
              <button onClick={async () => { await api.post(`/api/facturacion/casos/${drawerCaso.id}/resolver`, { accion: 'DESCARTAR' }); setDrawerCaso(null); cargar(); }} style={{ ...btnLight, flex: 1 }}>Descartar</button>
            </div>
          </div>
        )}
      >
        {drawerCaso && (
          <div style={{ background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
            {drawerCaso.descripcion || 'Sin detalle adicional registrado por el agente de Facturación.'}
          </div>
        )}
      </Drawer>

      <Drawer
        open={facturaDetalleLoading || !!facturaDetalle}
        onClose={() => setFacturaDetalle(null)}
        title={facturaDetalle ? `Factura ${facturaDetalle.numero}` : 'Cargando factura…'}
        subtitle={facturaDetalle && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={tagBox(facturaDetalle.tipo_factura === 'CICLICA' ? { color: colors.greenDark, bg: colors.greenBg } : { color: colors.blueDark, bg: colors.blueBg })}>
              {facturaDetalle.tipo_factura === 'CICLICA' ? 'Cíclica' : 'Acíclica'}
            </span>
            <span style={tagBox({ color: colors.textMuted, bg: '#F1F4F8' })}>{facturaDetalle.estado}</span>
          </div>
        )}
      >
        {facturaDetalleLoading && <div style={{ fontSize: 13, color: colors.textMuted }}>Cargando…</div>}
        {facturaDetalle && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div><div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted }}>CLIENTE</div><div style={{ ...monoFont, fontSize: 13, fontWeight: 600, color: colors.textStrong, marginTop: 2 }}>{facturaDetalle.cliente_nombre || '—'}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted }}>MONTO</div><div style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, marginTop: 2 }}>{money(facturaDetalle.monto)}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted }}>FECHA DE EMISIÓN</div><div style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>{fecha(facturaDetalle.fecha_emision)}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted }}>FECHA DE VENCIMIENTO</div><div style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>{fecha(facturaDetalle.fecha_vencimiento)}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted }}>CONFORMIDAD</div><div style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>{facturaDetalle.conformidad_estado}</div></div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, marginBottom: 8 }}>Validaciones de esta factura</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {facturaDetalle.validaciones.map((v) => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                  <span style={{ color: colors.text }}>{v.tipo_validacion}{v.observacion ? ` — ${v.observacion}` : ''}</span>
                  <span style={tagBox(resultadoStyle(v.resultado))}>{v.resultado}</span>
                </div>
              ))}
              {facturaDetalle.validaciones.length === 0 && <div style={{ fontSize: 12.5, color: colors.textFaint }}>Sin validaciones registradas.</div>}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function ColumnaCard({ titulo, badge, children }: { titulo: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong }}>{titulo}</div>
        {badge && <span style={tagBox({ color: colors.redDark, bg: colors.redBg })}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

/** Columna 1 de las 4 separaciones de Facturación: acceso principal a "Crear
 * nueva factura desde correo" (reemplaza el antiguo tab "Resumen del ciclo"). */
function ColumnaCrear({ resumen, emision, onCrear, onIrA }: { resumen: Resumen | null; emision: Emision[]; onCrear: () => void; onIrA: (destino: 'validaciones' | 'casos' | 'emision') => void }) {
  const listas = emision.filter((e) => e.puede_emitir).length;
  return (
    <div style={{ background: colors.navy, borderRadius: 10, padding: 18, color: '#fff', minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Crear nueva factura</div>
      <div style={{ fontSize: 12.5, color: '#B9C4D6', lineHeight: 1.5, marginBottom: 16 }}>
        Pega el correo del cliente. TRAZA entiende el contenido y prepara la factura.
      </div>
      <button
        onClick={onCrear}
        style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: '#fff', color: colors.navy, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        ✨ Extraer desde correo
      </button>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MetricaClickeable label="Documentos por emitir" value={resumen?.validacion.total ?? '—'} onClick={() => onIrA('validaciones')} />
        <MetricaClickeable label="Esperando conformidad" value={resumen?.conformidad.pendientes ?? '—'} onClick={() => onIrA('emision')} />
        <MetricaClickeable label="Listas para emitir" value={listas} onClick={() => onIrA('emision')} />
      </div>
    </div>
  );
}

function MetricaClickeable({ label, value, onClick }: { label: string; value: string | number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '6px 8px', margin: '0 -8px', borderRadius: 6, cursor: 'pointer' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: '#B9C4D6' }}>{label}</span>
      <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>{value} <span style={{ opacity: 0.5, fontSize: 11 }}>→</span></span>
    </div>
  );
}

function ConformidadScreen({ facturaId, onVolver, onCambio }: { facturaId: string; onVolver: () => void; onCambio: () => void }) {
  const [data, setData] = useState<any>(null);
  const [respuesta, setRespuesta] = useState('');

  const cargar = () => api.get(`/api/facturacion/conformidades/${facturaId}`).then(setData).catch(() => setData(null));
  useEffect(() => { cargar(); }, [facturaId]);

  if (!data) return (
    <div>
      <div onClick={onVolver} style={{ fontSize: 12.5, color: colors.blueDark, cursor: 'pointer', marginBottom: 16 }}>← Volver</div>
      <div style={{ fontSize: 13, color: colors.textMuted }}>Esta factura no tiene una solicitud de conformidad activa.</div>
    </div>
  );

  const estadoTag: Record<string, { color: string; bg: string }> = {
    PENDIENTE: { color: colors.amberDark, bg: colors.amberBg },
    APROBADO: { color: colors.greenDark, bg: colors.greenBg },
    OBSERVADO: { color: colors.amberDark, bg: colors.amberBg },
    SIN_RESPUESTA: { color: colors.redDark, bg: colors.redBg },
  };

  return (
    <div>
      <div onClick={onVolver} style={{ fontSize: 12.5, color: colors.blueDark, cursor: 'pointer', marginBottom: 16 }}>← Volver a Facturación</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: colors.textStrong }}>Conformidad del cliente</div>
          <div style={{ ...monoFont, fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            {data.cliente_nombre} · {data.factura_numero}{data.monto != null ? ` · ${money(data.monto)}` : ''}
          </div>
        </div>
        <span style={tagBox(estadoTag[data.estado] || estadoTag.PENDIENTE)}>{data.estado}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontSize: 12.5, color: colors.textMuted }}>
        <span style={{ fontWeight: 700, color: colors.textStrong }}>Facturación</span>
        <span>─── ✉ Cliente ───</span>
        <span style={{ fontWeight: 700, color: data.estado === 'APROBADO' ? colors.greenDark : colors.textMuted }}>
          {data.estado === 'APROBADO' ? 'Aprobada ✓' : data.estado === 'OBSERVADO' ? 'Observada' : 'Esperando respuesta'}
        </span>
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

const FUENTES = ['Clientes', 'Servicios', 'Tarifas', 'Periodos', 'Contratos'];

/** Reemplaza el spinner por una vista corta de qué fuentes consolidó el agente
 * (sección 20 del prompt de rediseño) — solo en primera carga o al reprocesar. */
function ConsolidationIntro({ total }: { total?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={motionTokens.default}
      style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}
    >
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {FUENTES.map((f, i) => (
          <motion.div
            key={f}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...motionTokens.fast, delay: i * 0.16 }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: colors.text }}
          >
            {f}
            <span style={{ color: colors.greenDark, fontWeight: 700 }}>✓</span>
          </motion.div>
        ))}
        {total != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...motionTokens.fast, delay: FUENTES.length * 0.16 }}
            style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: colors.textStrong }}
          >
            {total} documentos consolidados
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/** Momento de handoff Facturación → Cobranzas al emitir (sección 24): breve,
 * discreto, sin celebración — solo confirma que el trabajo pasó de agente. */
function EmisionHandoff({ numero, monto }: { numero: string; monto: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={motionTokens.default}
      style={{ background: colors.greenBg, border: '1px solid #BFE8CE', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.greenDark }}>Factura emitida — {numero}</div>
        <div style={{ fontSize: 12.5, color: colors.text, marginTop: 2 }}>{money(monto)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: colors.textMuted, marginLeft: 'auto' }}>
        <span style={{ fontWeight: 600, color: colors.textStrong }}>Facturación</span>
        <motion.span
          initial={{ x: -8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, ...motionTokens.default }}
        >
          ──▶
        </motion.span>
        <span style={{ fontWeight: 600, color: colors.textStrong }}>Cobranzas</span>
      </div>
    </motion.div>
  );
}

function Aviso({ tono, texto }: { tono: 'green' | 'amber'; texto: string }) {
  const bg = tono === 'green' ? colors.greenBg : colors.amberBg;
  const border = tono === 'green' ? '#BFE8CE' : '#F5DCA6';
  const fg = tono === 'green' ? colors.greenDark : colors.amberDark;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={motionTokens.default}
      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, color: fg }}
    >
      {texto}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Crear factura desde correo — el Agente de Facturación interpreta un correo
// pegado por el analista y estructura los datos, en vez de pedir un formulario.
// ---------------------------------------------------------------------------

const EJEMPLO_CORREO = `Buenos días,

Solicitamos emitir la factura correspondiente al servicio de soporte y mantenimiento de plataforma del mes de agosto.

Razón social: NEXO SOFTWARE SOLUTIONS S.L.
RUC/CIF: 891237654
Servicio: Mantenimiento plataforma SaaS
Periodo: Agosto 2026
Monto acordado: S/ 38,400.00
Orden de servicio: OS-2026-01842

Agradecemos emitir el documento con fecha 26/08/2026.

Saludos.`;

type CampoKey = 'cliente' | 'ruc' | 'servicio' | 'periodo' | 'monto' | 'orden' | 'fecha';
type CampoExtraido = { valor: string | null; inicio: number; fin: number };

const CAMPO_LABEL: Record<CampoKey, string> = {
  cliente: 'Cliente', ruc: 'RUC / CIF', servicio: 'Servicio', periodo: 'Periodo',
  monto: 'Monto', orden: 'Orden / referencia', fecha: 'Fecha de emisión solicitada',
};

const PATRONES: Record<CampoKey, RegExp> = {
  cliente: /Raz[oó]n social:\s*([^\n\r]+)/i,
  ruc: /RUC\s*\/?\s*CIF:\s*([^\n\r]+)/i,
  servicio: /Servicio:\s*([^\n\r]+)/i,
  periodo: /Periodo:\s*([^\n\r]+)/i,
  monto: /Monto(?:\s+acordado)?:\s*([^\n\r]+)/i,
  orden: /Orden(?:\s+de\s+servicio|\s*\/\s*referencia)?:\s*([^\n\r]+)/i,
  fecha: /fecha\s+(?:de\s+emisi[oó]n\s+)?(?:solicitada\s+)?(?:con\s+fecha\s+)?(\d{2}\/\d{2}\/\d{4})/i,
};

function extraerDatos(correo: string): Record<CampoKey, CampoExtraido> {
  const out = {} as Record<CampoKey, CampoExtraido>;
  (Object.keys(PATRONES) as CampoKey[]).forEach((k) => {
    const m = correo.match(PATRONES[k]);
    if (m && m.index != null && m[1]) {
      const valor = m[1].trim();
      const inicio = correo.indexOf(valor, m.index);
      out[k] = { valor, inicio, fin: inicio + valor.length };
    } else {
      out[k] = { valor: null, inicio: -1, fin: -1 };
    }
  });
  return out;
}

function esCiclica(correo: string): boolean {
  return /recurrente|cada mes|mensualidad|ciclo autom[aá]tico|facturaci[oó]n autom[aá]tica/i.test(correo);
}

function parseMonto(v: string | null): number {
  if (!v) return 0;
  const n = v.replace(/[^\d.,]/g, '').replace(/,/g, '');
  return parseFloat(n) || 0;
}

function CrearFacturaDesdeCorreo({ onVolver, onPreparada, onCasoDetectado }: {
  onVolver: () => void; onPreparada: () => void; onCasoDetectado: () => void;
}) {
  const [correo, setCorreo] = useState('');
  const [fase, setFase] = useState<'input' | 'procesando' | 'resultado'>('input');
  const [pasoProcesando, setPasoProcesando] = useState(0);
  const [campos, setCampos] = useState<Record<CampoKey, CampoExtraido> | null>(null);
  const [ciclica, setCiclica] = useState(false);
  const [origenActivo, setOrigenActivo] = useState<CampoKey | null>(null);
  const [editando, setEditando] = useState<Partial<Record<CampoKey, string>>>({});
  const [preparando, setPreparando] = useState(false);
  const [eventosLog, setEventosLog] = useState<string[]>([]);

  const extraer = () => {
    if (!correo.trim()) return;
    const reduced = prefersReducedMotion();
    setFase('procesando');
    setPasoProcesando(1);
    setTimeout(() => setPasoProcesando(2), reduced ? 0 : 550);
    setTimeout(() => setPasoProcesando(3), reduced ? 0 : 1100);
    setTimeout(() => {
      setCampos(extraerDatos(correo));
      setCiclica(esCiclica(correo));
      setFase('resultado');
    }, reduced ? 0 : 1650);
  };

  const valorFinal = (k: CampoKey): string | null => editando[k] ?? campos?.[k].valor ?? null;

  const camposCriticos: CampoKey[] = ['cliente', 'ruc', 'monto'];
  const faltanCriticos = campos ? camposCriticos.some((k) => !valorFinal(k)) : false;

  const validaciones = campos ? [
    { ok: !!valorFinal('cliente'), label: 'Cliente encontrado' },
    { ok: !!valorFinal('servicio'), label: 'Servicio activo' },
    { ok: !!valorFinal('ruc'), label: 'Datos fiscales completos' },
    { ok: !!valorFinal('periodo'), label: 'Periodo válido' },
    { ok: parseMonto(valorFinal('monto')) > 0, label: 'Tarifa consistente' },
  ] : [];

  const preparar = () => {
    if (!campos) return;
    setPreparando(true);
    setEventosLog([]);
    const camposIdentificados = (Object.keys(campos) as CampoKey[]).filter((k) => valorFinal(k)).length;
    const lineas = [
      'Contenido de correo recibido',
      'Identificando cliente...',
      `Cliente identificado: ${valorFinal('cliente')}`,
      'Extrayendo datos de facturación...',
      `${camposIdentificados} campos identificados`,
      'Validando servicio y periodo...',
      'Validaciones completadas',
      'Factura preparada para revisión',
    ];
    let i = 0;
    const reduced = prefersReducedMotion();
    const push = () => {
      if (i >= lineas.length) return;
      const hora = new Date().toLocaleTimeString('es-PE', { hour12: false });
      setEventosLog((prev) => [...prev, `${hora}  ${lineas[i]}`]);
      i += 1;
      setTimeout(push, reduced ? 0 : 260);
    };
    push();

    api.post('/api/facturacion/facturas/desde-correo', {
      cliente_nombre: valorFinal('cliente'),
      ruc: valorFinal('ruc'),
      monto: parseMonto(valorFinal('monto')),
      servicio: valorFinal('servicio'),
      periodo: valorFinal('periodo'),
      orden: valorFinal('orden'),
      fecha_emision: valorFinal('fecha'),
      tipo_factura: ciclica ? 'CICLICA' : 'ACICLICA',
    })
      .then(() => setTimeout(onPreparada, reduced ? 0 : 900))
      .catch(() => {
        setEventosLog((prev) => [...prev, 'No se pudo registrar la factura. Intenta de nuevo.']);
        setPreparando(false);
      });
  };

  return (
    <div>
      <div onClick={onVolver} style={{ fontSize: 12.5, color: colors.blueDark, cursor: 'pointer', marginBottom: 16 }}>← Volver</div>

      {fase === 'input' && (
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textStrong }}>Crear factura desde correo</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 6, marginBottom: 20, maxWidth: 580 }}>
            Pega el contenido recibido del cliente. El Agente de Facturación identificará automáticamente la información necesaria para preparar la factura.
          </div>
          <div style={{ background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 12 }}>Contenido del correo</div>
            <textarea
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="Pega aquí el correo recibido del cliente..."
              style={{ width: '100%', minHeight: 220, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 14, fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', background: '#fff' }}
            />
            {!correo && (
              <div onClick={() => setCorreo(EJEMPLO_CORREO)} style={{ marginTop: 10, fontSize: 12.5, color: colors.blueDark, cursor: 'pointer' }}>Usar correo de ejemplo</div>
            )}
            <div style={{ marginTop: 16 }}>
              <button onClick={extraer} disabled={!correo.trim()} style={{ ...btnDark, opacity: correo.trim() ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                ✨ Extraer datos de factura
              </button>
            </div>
          </div>
        </div>
      )}

      {fase === 'procesando' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 18 }}>Agente de Facturación procesando correo...</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto', textAlign: 'left' }}>
            {['Identificando cliente', 'Extrayendo datos de facturación', 'Validando información'].map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: pasoProcesando > i ? colors.textStrong : colors.textFaint, fontWeight: pasoProcesando > i ? 600 : 400 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${pasoProcesando > i ? colors.blue : colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: colors.blue, flexShrink: 0 }}>
                  {pasoProcesando > i ? '✓' : i + 1}
                </span>
                {label}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {fase === 'resultado' && campos && (
        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 20, alignItems: 'start' }}>
          <div style={{ background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textStrong, marginBottom: 10 }}>Correo recibido</div>
            <div style={{ fontSize: 12.5, color: colors.text, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {renderCorreoConResaltado(correo, campos, origenActivo)}
            </div>
          </div>

          <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 16 }}>Datos identificados</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              {(Object.keys(CAMPO_LABEL) as CampoKey[]).map((k) => (
                <CampoResultado
                  key={k}
                  label={CAMPO_LABEL[k]}
                  valor={valorFinal(k)}
                  tieneOrigen={campos[k].valor != null}
                  activo={origenActivo === k}
                  onVerOrigen={() => setOrigenActivo(origenActivo === k ? null : k)}
                  onCompletar={(v) => setEditando((prev) => ({ ...prev, [k]: v }))}
                />
              ))}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 4 }}>TIPO DE FACTURACIÓN</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>{ciclica ? 'Cíclica' : 'Acíclica'}</div>
                <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                  {ciclica ? 'Puede continuar a emisión después de las validaciones.' : 'Requiere conformidad previa del cliente antes de emisión.'}
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${colors.borderLight}`, paddingTop: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, marginBottom: 8 }}>Validación</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {validaciones.map((v) => (
                  <div key={v.label} style={{ fontSize: 12.5, color: v.ok ? colors.greenDark : colors.amberDark, fontWeight: 600 }}>
                    {v.ok ? '✓' : '⚠'} {v.label}{!v.ok ? ' — requiere revisión' : ''}
                  </div>
                ))}
              </div>
            </div>

            {preparando ? (
              <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 14, ...monoFont, fontSize: 11.5, color: colors.text, minHeight: 130 }}>
                {eventosLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            ) : faltanCriticos ? (
              <div style={{ background: colors.amberBg, border: '1px solid #F5DCA6', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.amberDark }}>No se puede preparar todavía</div>
                <div style={{ fontSize: 12.5, color: colors.text, marginTop: 4, marginBottom: 12 }}>TRAZA encontró información que requiere revisión.</div>
                <button onClick={onCasoDetectado} style={btnDark}>Enviar a Casos detectados</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setOrigenActivo(null)} style={btnLight}>Editar datos</button>
                <button onClick={preparar} style={btnDark}>Preparar factura</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CampoResultado({ label, valor, tieneOrigen, activo, onVerOrigen, onCompletar }: {
  label: string; valor: string | null; tieneOrigen: boolean; activo: boolean;
  onVerOrigen: () => void; onCompletar: (v: string) => void;
}) {
  if (!valor) {
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 4 }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: 12.5, color: colors.amberDark, fontWeight: 600, marginBottom: 6 }}>⚠ No identificado</div>
        <input
          placeholder="Completar manualmente"
          onBlur={(e) => e.target.value.trim() && onCompletar(e.target.value.trim())}
          style={{ width: '100%', fontSize: 12.5, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }}
        />
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.textStrong }}>{valor}</div>
      {tieneOrigen && (
        <div onClick={onVerOrigen} style={{ fontSize: 11, color: activo ? colors.blueDark : colors.textFaint, cursor: 'pointer', marginTop: 3, fontWeight: activo ? 700 : 400 }}>
          {activo ? '● Viendo origen' : 'Ver origen'}
        </div>
      )}
    </div>
  );
}

function renderCorreoConResaltado(correo: string, campos: Record<CampoKey, CampoExtraido>, activo: CampoKey | null) {
  if (!activo || campos[activo].inicio < 0) return correo;
  const { inicio, fin } = campos[activo];
  return (
    <>
      {correo.slice(0, inicio)}
      <mark style={{ background: '#E0D6FA', color: colors.textStrong, borderRadius: 3, padding: '0 2px' }}>{correo.slice(inicio, fin)}</mark>
      {correo.slice(fin)}
    </>
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
