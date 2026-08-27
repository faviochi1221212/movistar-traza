import { useEffect, useState } from 'react';
import { colors } from '../../lib/styles';
import { api } from '../../lib/api';
import {
  QUICK_PROMPTS, interpretarPreguntaLibre, responderFacturasPendientes, responderSeguirCobrando, responderInsightBI,
  type Detalle,
} from './cliente360Logic';

type Msg = { role: 'user' | 'ai'; texto: string };

const PREGUNTAS_PRECARGADAS = [
  { pregunta: '¿Qué facturas tiene pendientes este cliente?', resolver: responderFacturasPendientes },
  { pregunta: '¿Debemos seguir cobrando?', resolver: responderSeguirCobrando },
  { pregunta: '¿Qué insight relevante ves?', resolver: responderInsightBI },
];

export default function Cliente360Asistente({ detalle, onRefrescar }: { detalle: Detalle; onRefrescar: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);

  useEffect(() => {
    if (clienteId === detalle.cliente.id) return;
    setClienteId(detalle.cliente.id);
    const precargadas: Msg[] = [];
    PREGUNTAS_PRECARGADAS.forEach(({ pregunta, resolver }) => {
      precargadas.push({ role: 'user', texto: pregunta });
      precargadas.push({ role: 'ai', texto: resolver(detalle) });
    });
    setMsgs(precargadas);
  }, [detalle.cliente.id]);

  const enviar = async (pregunta?: string) => {
    const q = (pregunta ?? input).trim();
    if (!q || loading) return;
    setMsgs((m) => [...m, { role: 'user', texto: q }]);
    setInput('');
    setLoading(true);
    try {
      const local = interpretarPreguntaLibre(q, detalle);
      if (local) {
        setMsgs((m) => [...m, { role: 'ai', texto: local }]);
      } else {
        const r = await api.post<{ respuesta: string }>('/api/chat', { pregunta: `${q} (cliente: ${detalle.cliente.razon_social})` });
        setMsgs((m) => [...m, { role: 'ai', texto: r.respuesta }]);
      }
    } catch (err) {
      setMsgs((m) => [...m, { role: 'ai', texto: `No pude obtener una respuesta (${String(err)}).` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.green, flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong }}>Asistente Cliente 360</div>
          </div>
          <div style={{ display: 'flex', gap: 10, color: colors.textFaint, fontSize: 13 }}>
            <span onClick={onRefrescar} style={{ cursor: 'pointer' }} title="Refrescar">↻</span>
            <span style={{ cursor: 'pointer' }} title="Más opciones">⋯</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 5 }}>Contexto unificado: Facturación · Cobranza · BI</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '94%' }}>
            <div style={m.role === 'user'
              ? { background: colors.navy, color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '9px 12px', fontSize: 12.5, lineHeight: 1.45 }
              : { background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: '10px 10px 10px 2px', padding: '9px 12px', fontSize: 12.5, color: colors.text, lineHeight: 1.5 }}>
              {m.texto}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 11.5, color: colors.textFaint }}>Analizando contexto del cliente...</div>}
      </div>

      <div style={{ padding: '10px 16px', borderTop: `1px solid ${colors.borderLight}` }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {QUICK_PROMPTS.map((p) => (
            <span key={p.texto} onClick={() => enviar(p.texto)} style={{ fontSize: 11, color: colors.blueDark, background: colors.blueBg, borderRadius: 20, padding: '5px 11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {p.texto}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()}
            placeholder="Haz una pregunta sobre este cliente..."
            style={{ flex: 1, height: 40, background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 12px', fontSize: 12.5, color: colors.text, outline: 'none', boxSizing: 'border-box' }}
          />
          <button onClick={() => enviar()} style={{ width: 40, height: 40, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>➤</button>
        </div>
        <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>🛈</span> El asistente usa contexto en tiempo real de Facturación, Cobranza y BI.
        </div>
      </div>
    </div>
  );
}
