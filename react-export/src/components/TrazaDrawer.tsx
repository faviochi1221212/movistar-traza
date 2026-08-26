import { useState } from 'react';
import Drawer from './Drawer';
import { api } from '../lib/api';
import { colors } from '../lib/styles';

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

/** Global right-side drawer: pregunta libre a TRAZA (FastAPI + Dify + datos reales). */
export default function TrazaDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <Drawer open={open} onClose={() => { onClose(); setMsgs([]); }} width={420} title="Preguntar a TRAZA">
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
    </Drawer>
  );
}
