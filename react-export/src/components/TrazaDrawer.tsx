import { useEffect, useState } from 'react';
import Drawer from './Drawer';
import { api } from '../lib/api';
import { colors, tabStyle } from '../lib/styles';

const SUGERIDAS = [
  '¿Cuál es la cartera vencida actual?',
  '¿Qué clientes tienen mayor riesgo de pago?',
  '¿Qué facturas están pendientes de conformidad?',
  '¿Qué pagos necesitan revisión manual?',
  '¿Cuál es el ratio cobrado/facturado?',
  '¿Qué oportunidades de recupero tenemos?',
  '¿Qué casos críticos necesitan atención?',
];

type Msg = { role: 'user' | 'ai'; text: string };
type Regla = { id: string; codigo: string; modulo: string; nombre: string; descripcion: string | null; tipo_valor: string; valor: any; unidad: string | null };
type Modo = 'preguntar' | 'configurar';

/** Global right-side drawer: pregunta libre a TRAZA (FastAPI + Dify + datos reales)
 * y, en modo Configurar, edita las mismas reglas de negocio reales que usa
 * el módulo Configuración — misma fuente de verdad, sin datos de ejemplo. */
export default function TrazaDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [modo, setModo] = useState<Modo>('preguntar');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [reglas, setReglas] = useState<Regla[]>([]);
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargarReglas = () => api.get<Regla[]>('/api/configuracion/reglas').then(setReglas).catch(() => setReglas([]));
  useEffect(() => { if (open && modo === 'configurar' && reglas.length === 0) cargarReglas(); }, [open, modo]);

  const guardarRegla = async (codigo: string) => {
    const raw = editando[codigo];
    if (raw === undefined) return;
    setGuardando(codigo);
    const valor = Number.isNaN(Number(raw)) ? raw : Number(raw);
    try {
      await api.put(`/api/configuracion/reglas/${codigo}`, { valor });
      await cargarReglas();
      setEditando((e) => { const c = { ...e }; delete c[codigo]; return c; });
    } finally {
      setGuardando(null);
    }
  };

  const enviar = async (pregunta?: string) => {
    const q = (pregunta ?? input).trim();
    if (!q || loading) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const r = await api.post<{ respuesta: string }>('/api/chat', { pregunta: q });
      setMsgs((m) => [...m, { role: 'ai', text: r.respuesta }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: 'ai', text: `No pude obtener una respuesta (${String(err)}).` }]);
    } finally {
      setLoading(false);
    }
  };

  const grupos = reglas.reduce<Record<string, Regla[]>>((acc, r) => {
    (acc[r.modulo] ||= []).push(r);
    return acc;
  }, {});

  return (
    <Drawer open={open} onClose={() => { onClose(); setMsgs([]); setModo('preguntar'); }} width={440} title="TRAZA">
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, marginTop: -6 }}>
        <div onClick={() => setModo('preguntar')} style={tabStyle(modo === 'preguntar')}>Preguntar</div>
        <div onClick={() => setModo('configurar')} style={tabStyle(modo === 'configurar')}>Configurar</div>
      </div>

      {modo === 'preguntar' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>
            {msgs.length === 0 && (
              <>
                <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 6 }}>Preguntas sugeridas</div>
                {SUGERIDAS.map((s) => (
                  <div key={s} onClick={() => enviar(s)} style={{ fontSize: 13, color: '#2050C4', background: '#EAF1FC', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>{s}</div>
                ))}
              </>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={m.role === 'user'
                ? { alignSelf: 'flex-end', maxWidth: '85%', background: colors.navy, color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '10px 14px', fontSize: 13.5 }
                : { alignSelf: 'flex-start', maxWidth: '90%', background: '#F8FAFC', border: '1px solid #E2E5EA', borderRadius: '10px 10px 10px 2px', padding: '12px 14px', fontSize: 13.5, color: '#1A2433', lineHeight: 1.6 }}>
                {m.text}
              </div>
            ))}
            {loading && <div style={{ fontSize: 12.5, color: '#94A3B8' }}>TRAZA está pensando…</div>}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="Escribe tu pregunta..." style={{ flex: 1, height: 38, border: '1px solid #E2E5EA', borderRadius: 7, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={() => enviar()} style={{ width: 38, height: 38, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 14, cursor: 'pointer' }}>➜</button>
          </div>
        </>
      ) : (
        <div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
            Reglas de negocio reales que usa TRAZA para automatizar decisiones. Cambiar un valor aquí lo cambia en todo el sistema — es la misma fuente que el módulo Configuración.
          </div>
          {Object.entries(grupos).map(([modulo, items]) => (
            <div key={modulo} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.textStrong, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>{modulo}</div>
              {items.map((r) => {
                const valorActual = editando[r.codigo] ?? String(r.valor);
                const cambiado = editando[r.codigo] !== undefined && editando[r.codigo] !== String(r.valor);
                return (
                  <div key={r.id} style={{ borderBottom: `1px solid ${colors.borderLight}`, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{r.nombre}</div>
                      {r.descripcion && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{r.descripcion}</div>}
                    </div>
                    <input value={valorActual} onChange={(e) => setEditando((s) => ({ ...s, [r.codigo]: e.target.value }))}
                      style={{ height: 32, width: 78, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '0 8px', fontSize: 12.5, outline: 'none', flexShrink: 0 }} />
                    {r.unidad && <span style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0 }}>{r.unidad}</span>}
                    <button disabled={!cambiado || guardando === r.codigo} onClick={() => guardarRegla(r.codigo)}
                      style={{ height: 32, padding: '0 10px', borderRadius: 6, border: 'none', background: colors.navy, color: '#fff', fontSize: 11.5, fontWeight: 600, flexShrink: 0, opacity: cambiado ? 1 : 0.35, cursor: cambiado ? 'pointer' : 'default' }}>
                      {guardando === r.codigo ? '…' : 'Guardar'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {reglas.length === 0 && <div style={{ fontSize: 12.5, color: colors.textFaint }}>Cargando reglas…</div>}
        </div>
      )}
    </Drawer>
  );
}
