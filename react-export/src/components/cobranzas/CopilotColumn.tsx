import { useState } from 'react';
import { colors } from '../../lib/styles';
import { api, money, fecha } from '../../lib/api';

type CarteraRow = { factura_id: string; numero: string; cliente_id: string; razon_social: string; saldo_pendiente: number; fecha_vencimiento: string; dias_vencidos: number };
type Msg = { role: 'user' | 'ai'; text: string; timestamp: string; tabla?: TablaResultado };
type TablaResultado = { filas: CarteraRow[]; desde: string; hasta: string };
type ActividadItem = { hora: string; texto: string };

const PATRON_VENCE = /vencen?\s+en\s+los?\s+pr[oó]ximos?\s+(\d+)\s*d[ií]as|vencimiento.*pr[oó]ximos?\s+(\d+)\s*d[ií]as/i;

function horaAhora(): string {
  return new Date().toLocaleTimeString('es-PE', { hour12: false });
}

function riesgoLabel(nivel: string | undefined): { label: string; fg: string; bg: string } {
  if (nivel === 'ALTO') return { label: 'Alto', fg: colors.redDark, bg: colors.redBg };
  if (nivel === 'MEDIO') return { label: 'Medio', fg: colors.amberDark, bg: colors.amberBg };
  if (nivel === 'BAJO') return { label: 'Bajo', fg: colors.greenDark, bg: colors.greenBg };
  return { label: 'Sin evaluar', fg: colors.textFaint, bg: '#F1F4F8' };
}

export default function CopilotColumn({
  cartera, riesgoPorCliente, onUsarComoFiltro,
}: {
  cartera: CarteraRow[]; riesgoPorCliente: Map<string, string>; onUsarComoFiltro: (desde: string, hasta: string) => void;
}) {
  const [tab, setTab] = useState<'copiloto' | 'actividad'>('copiloto');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actividad, setActividad] = useState<ActividadItem[]>([]);
  const [paginas, setPaginas] = useState<Record<number, number>>({});

  const log = (texto: string) => setActividad((a) => [...a, { hora: horaAhora(), texto }]);

  const construirTablaVencimiento = (dias: number): TablaResultado => {
    const hoy = new Date();
    const limite = new Date(hoy); limite.setDate(hoy.getDate() + dias);
    const filas = cartera
      .filter((c) => {
        const fv = new Date(c.fecha_vencimiento);
        return fv >= hoy && fv <= limite;
      })
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());
    return { filas, desde: hoy.toISOString().slice(0, 10), hasta: limite.toISOString().slice(0, 10) };
  };

  const enviar = async (pregunta?: string) => {
    const q = (pregunta ?? input).trim();
    if (!q || loading) return;
    const ts = horaAhora();
    setMsgs((m) => [...m, { role: 'user', text: q, timestamp: ts }]);
    setInput('');
    setLoading(true);
    log('Consulta recibida');
    log('Interpretando intención');

    const matchVence = q.match(PATRON_VENCE);
    try {
      if (matchVence) {
        const dias = Number(matchVence[1] || matchVence[2] || 7);
        log('Consultando cartera');
        const tabla = construirTablaVencimiento(dias);
        log(`${tabla.filas.length} registros encontrados`);
        log('Ordenando por vencimiento');
        const montoTotal = tabla.filas.reduce((s, f) => s + Number(f.saldo_pendiente || 0), 0);
        const texto = tabla.filas.length > 0
          ? `Encontré ${tabla.filas.length} facturas por ${money(montoTotal)} que vencen entre el ${fecha(tabla.desde)} y el ${fecha(tabla.hasta)}. Las ordené por fecha de vencimiento.`
          : `No encontré facturas que venzan en los próximos ${dias} días.`;
        setMsgs((m) => [...m, { role: 'ai', text: texto, timestamp: horaAhora(), tabla }]);
        log('Respuesta generada');
      } else {
        log('Consultando datos de cobranza');
        const r = await api.post<{ respuesta: string }>('/api/chat', { pregunta: q });
        log('Respuesta generada');
        setMsgs((m) => [...m, { role: 'ai', text: r.respuesta, timestamp: horaAhora() }]);
      }
    } catch (err) {
      setMsgs((m) => [...m, { role: 'ai', text: `No pude obtener una respuesta (${String(err)}).`, timestamp: horaAhora() }]);
    } finally {
      setLoading(false);
    }
  };

  const exportarCsv = (tabla: TablaResultado) => {
    const header = 'Cliente,Factura,Vence,Monto,Riesgo\n';
    const rows = tabla.filas.map((f) => {
      const r = riesgoLabel(riesgoPorCliente.get(f.cliente_id)).label;
      return `"${f.razon_social}",${f.numero},${f.fecha_vencimiento},${f.saldo_pendiente},${r}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facturas_por_vencer.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Panel>
      <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong }}>Copiloto de Cobranzas</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 1.4 }}>Consulta facturas, pagos y cartera en lenguaje natural</div>
      </div>

      <div style={{ display: 'flex', gap: 18, padding: '10px 16px 0', borderBottom: `1px solid ${colors.border}` }}>
        {(['copiloto', 'actividad'] as const).map((t) => (
          <div key={t} onClick={() => setTab(t)} style={{ paddingBottom: 10, fontSize: 12.5, fontWeight: 600, color: tab === t ? colors.textStrong : colors.textMuted, borderBottom: tab === t ? `2px solid ${colors.blue}` : '2px solid transparent', cursor: 'pointer' }}>
            {t === 'copiloto' ? 'Copiloto' : 'Actividad del agente'}
          </div>
        ))}
      </div>

      {tab === 'actividad' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actividad.length === 0 && <div style={{ fontSize: 12.5, color: colors.textFaint }}>Sin actividad del copiloto todavía. Haz una pregunta para verla aquí.</div>}
          {actividad.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: colors.text }}>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: colors.textFaint, flexShrink: 0 }}>{a.hora}</span>
              <span>{a.texto}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {msgs.length === 0 && (
              <div style={{ fontSize: 12, color: colors.textFaint, lineHeight: 1.6 }}>
                Prueba: "Entrégame el listado de las facturas que vencen en los próximos 7 días."
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                <div style={m.role === 'user'
                  ? { background: colors.navy, color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '10px 13px', fontSize: 12.5, lineHeight: 1.5 }
                  : { background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: '10px 10px 10px 2px', padding: '10px 13px', fontSize: 12.5, color: colors.text, lineHeight: 1.5 }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 3, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.timestamp}</div>
                {m.tabla && m.tabla.filas.length > 0 && (
                  <ResultadoTabla tabla={m.tabla} riesgoPorCliente={riesgoPorCliente} pagina={paginas[i] || 0}
                    onPagina={(p) => setPaginas((prev) => ({ ...prev, [i]: p }))}
                    onExportar={() => exportarCsv(m.tabla!)}
                    onUsarComoFiltro={() => { onUsarComoFiltro(m.tabla!.desde, m.tabla!.hasta); log('Filtro aplicado a la gestión de cobranza'); }}
                  />
                )}
              </div>
            ))}
            {loading && <div style={{ fontSize: 11.5, color: colors.textFaint }}>Consultando datos de cobranza...</div>}
          </div>

          <div style={{ padding: 14, borderTop: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()}
                placeholder="Pregúntale a TRAZA sobre facturas, pagos o clientes..."
                style={{ flex: 1, height: 42, background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 14px', fontSize: 12.5, color: colors.text, outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={() => enviar()} style={{ width: 42, height: 42, borderRadius: 7, border: 'none', background: colors.blue, color: '#fff', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>➤</button>
            </div>
            <div style={{ fontSize: 10.5, color: colors.textFaint, marginTop: 10 }}>El copiloto usa datos en tiempo real de TRAZA</div>
          </div>
        </>
      )}
    </Panel>
  );
}

function ResultadoTabla({ tabla, riesgoPorCliente, pagina, onPagina, onExportar, onUsarComoFiltro }: {
  tabla: TablaResultado; riesgoPorCliente: Map<string, string>; pagina: number; onPagina: (p: number) => void;
  onExportar: () => void; onUsarComoFiltro: () => void;
}) {
  const pageSize = 4;
  const totalPaginas = Math.max(1, Math.ceil(tabla.filas.length / pageSize));
  const visibles = tabla.filas.slice(pagina * pageSize, pagina * pageSize + pageSize);

  return (
    <div style={{ marginTop: 8, background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
          <thead>
            <tr>
              {['Cliente', 'Factura', 'Vence', 'Monto', 'Riesgo'].map((h) => (
                <th key={h} style={{ textAlign: h === 'Monto' ? 'right' : 'left', fontSize: 10, fontWeight: 600, color: colors.textFaint, padding: '4px 6px', borderBottom: `1px solid ${colors.borderLight}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const r = riesgoLabel(riesgoPorCliente.get(f.cliente_id));
              return (
                <tr key={f.factura_id}>
                  <td style={{ padding: '6px 6px', fontSize: 11.5, color: colors.text, borderBottom: `1px solid ${colors.borderLight}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{f.razon_social}</td>
                  <td style={{ padding: '6px 6px', fontSize: 11, color: colors.textMuted, borderBottom: `1px solid ${colors.borderLight}` }}>{f.numero}</td>
                  <td style={{ padding: '6px 6px', fontSize: 11, color: colors.textMuted, borderBottom: `1px solid ${colors.borderLight}`, whiteSpace: 'nowrap' }}>{fecha(f.fecha_vencimiento)}</td>
                  <td style={{ padding: '6px 6px', fontSize: 11.5, fontWeight: 600, color: colors.textStrong, borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(f.saldo_pendiente)}</td>
                  <td style={{ padding: '6px 6px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={{ fontSize: 10, fontWeight: 600, color: r.fg, background: r.bg, borderRadius: 5, padding: '2px 6px' }}>{r.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 10.5, color: colors.textFaint }}>
        <span>{pagina * pageSize + 1}–{Math.min(tabla.filas.length, pagina * pageSize + visibles.length)} de {tabla.filas.length} facturas</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span onClick={() => pagina > 0 && onPagina(pagina - 1)} style={{ cursor: pagina > 0 ? 'pointer' : 'default', opacity: pagina > 0 ? 1 : 0.3 }}>‹</span>
          <span>{pagina + 1} / {totalPaginas}</span>
          <span onClick={() => pagina < totalPaginas - 1 && onPagina(pagina + 1)} style={{ cursor: pagina < totalPaginas - 1 ? 'pointer' : 'default', opacity: pagina < totalPaginas - 1 ? 1 : 0.3 }}>›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <MiniBtn onClick={onExportar}>⭳ Exportar</MiniBtn>
        <MiniBtn onClick={onUsarComoFiltro}>▤ Usar como filtro</MiniBtn>
      </div>
    </div>
  );
}

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.textMuted, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      {children}
    </div>
  );
}
