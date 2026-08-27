import { useState } from 'react';
import { colors } from '../../lib/styles';
import { api } from '../../lib/api';
import { interpretarPreguntaFacturacion, type IntentContext, type IntentResult, type ResultItem } from './facturacionIntents';

type Msg = { role: 'user' | 'ai'; texto: string; resultado?: IntentResult };

const SUGERENCIAS = ['¿Cuántas facturas tenemos este mes?', '¿Qué está bloqueando la emisión?', '¿Qué fuentes concentran más incidencias?'];

export default function FacturacionAssistant({ contexto }: { contexto: IntentContext }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ultimoContexto, setUltimoContexto] = useState<{ tipo: string; items: ResultItem[] } | null>(null);

  const enviar = async (pregunta?: string) => {
    const q = (pregunta ?? input).trim();
    if (!q || loading) return;
    setMsgs((m) => [...m, { role: 'user', texto: q }]);
    setInput('');
    setLoading(true);
    try {
      const resultado = interpretarPreguntaFacturacion(q, contexto, ultimoContexto);
      if (resultado) {
        if (resultado.contexto) setUltimoContexto(resultado.contexto);
        setMsgs((m) => [...m, { role: 'ai', texto: resultado.titulo, resultado }]);
      } else {
        const r = await api.post<{ respuesta: string }>('/api/chat', { pregunta: q });
        setMsgs((m) => [...m, { role: 'ai', texto: r.respuesta }]);
      }
    } catch (err) {
      setMsgs((m) => [...m, { role: 'ai', texto: `No pude obtener una respuesta (${String(err)}).` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '12px 16px 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.textStrong, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: colors.blue }}>✦</span> Preguntar sobre Facturación
        </div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 1.4 }}>
          Consulta desde indicadores generales hasta clientes, documentos, fuentes y casos específicos.
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ padding: '10px 0' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.textStrong, marginBottom: 4 }}>¿Qué necesitas saber sobre Facturación?</div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
              Puedo analizar documentos, validaciones, casos, conformidades, emisión y fuentes de información.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGERENCIAS.map((s) => (
                <div key={s} onClick={() => enviar(s)} style={{ fontSize: 11, color: colors.textFaint, cursor: 'pointer' }}>{s}</div>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '94%' }}>
            {m.role === 'user' ? (
              <div style={{ background: '#F1F4F8', borderRadius: '9px 9px 2px 9px', padding: '7px 11px', fontSize: 12, color: colors.text }}>{m.texto}</div>
            ) : (
              <RespuestaAI resultado={m.resultado} texto={m.texto} />
            )}
          </div>
        ))}
        {loading && <div style={{ fontSize: 11.5, color: colors.textFaint }}>Analizando Facturación...</div>}
      </div>

      <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${colors.borderLight}` }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Pregunta sobre Facturación..."
            rows={1}
            style={{ flex: 1, minHeight: 34, maxHeight: 90, background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 7, padding: '7px 10px', fontSize: 12, color: colors.text, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <button onClick={() => enviar()} style={{ width: 34, height: 34, borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>➤</button>
        </div>
      </div>
    </div>
  );
}

function RespuestaAI({ texto, resultado }: { texto: string; resultado?: IntentResult }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, lineHeight: 1.4 }}>{texto}</div>
      {resultado?.bullets && resultado.bullets.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {resultado.bullets.map((b, i) => (
            <div key={i} style={{ fontSize: 11.5, color: colors.text, display: 'flex', gap: 6 }}>
              <span style={{ color: colors.blue, flexShrink: 0 }}>·</span><span>{b}</span>
            </div>
          ))}
        </div>
      )}
      {resultado?.ranking && resultado.ranking.length > 0 && (
        <div style={{ marginTop: 8, background: '#F8FAFC', border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {resultado.ranking.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
              <span style={{ color: colors.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i + 1}. {r.label}</span>
              <span style={{ color: colors.textMuted, textAlign: 'right', flexShrink: 0 }}>{r.value}{r.sub ? ` · ${r.sub}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
