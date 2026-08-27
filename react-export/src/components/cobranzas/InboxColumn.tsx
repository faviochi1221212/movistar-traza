import { colors } from '../../lib/styles';
import { money } from '../../lib/api';

type Email = { id: string; cliente_nombre: string | null; asunto: string; cuerpo: string; clasificacion: string | null; confianza: number | null; procesado: boolean; recibido_at: string; adjuntos: { nombre: string }[]; factura_id: string | null };
type CarteraRow = { factura_id: string; numero: string; saldo_pendiente: number };

const CLASIF_LABEL: Record<string, string> = {
  CONFIRMACION_PAGO: 'Pago detectado', PROMESA_PAGO: 'Promesa de pago', CONSULTA: 'Consulta',
  RECLAMO: 'Reclamo', NOTA_CREDITO: 'Nota de crédito', OTRO: 'Otro',
};
const CLASIF_COLOR: Record<string, { fg: string; bg: string }> = {
  CONFIRMACION_PAGO: { fg: colors.greenDark, bg: colors.greenBg },
  PROMESA_PAGO: { fg: colors.amberDark, bg: colors.amberBg },
  CONSULTA: { fg: colors.blueDark, bg: colors.blueBg },
  RECLAMO: { fg: colors.redDark, bg: colors.redBg },
};

const CHIPS: { value: string; label: string; color?: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'CONFIRMACION_PAGO', label: 'Pago', color: colors.greenDark },
  { value: 'PROMESA_PAGO', label: 'Promesa', color: colors.amberDark },
  { value: 'CONSULTA', label: 'Consulta', color: colors.blueDark },
  { value: 'RECLAMO', label: 'Reclamo', color: colors.redDark },
];

function horaDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  const esAyer = d.toDateString() === ayer.toDateString();
  const hhmm = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (esHoy) return hhmm;
  if (esAyer) return `Ayer ${hhmm}`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) + ' ' + hhmm;
}

export default function InboxColumn({
  emails, cartera, filtro, onFiltro, search, onSearch, selectedId, onSelect,
}: {
  emails: Email[]; cartera: CarteraRow[]; filtro: string; onFiltro: (v: string) => void;
  search: string; onSearch: (v: string) => void; selectedId: string | null; onSelect: (e: Email) => void;
}) {
  const filtrados = emails.filter((e) => {
    if (filtro !== 'TODOS' && e.clasificacion !== filtro) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (e.cliente_nombre || '').toLowerCase().includes(q) || e.asunto.toLowerCase().includes(q);
    }
    return true;
  });

  const contar = (v: string) => (v === 'TODOS' ? emails.length : emails.filter((e) => e.clasificacion === v).length);
  const visibles = filtrados.slice(0, 4);

  return (
    <Panel>
      <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong }}>Bandeja IA</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Comunicaciones detectadas por IA</div>
      </div>

      <div style={{ padding: '14px 16px 10px' }}>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por cliente, asunto o factura..."
          style={{ width: '100%', height: 38, background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 12px', fontSize: 13, color: colors.text, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {CHIPS.map((c) => {
            const active = filtro === c.value;
            return (
              <div
                key={c.value}
                onClick={() => onFiltro(c.value)}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
                  color: active ? colors.blueDark : (c.color || colors.textMuted),
                  background: active ? colors.blueBg : '#F8FAFC',
                  border: `1px solid ${active ? colors.blue : colors.border}`,
                }}
              >
                {c.label} <span style={{ opacity: 0.7 }}>{contar(c.value)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 14px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibles.map((e) => {
            const factura = e.factura_id ? cartera.find((c) => c.factura_id === e.factura_id) : undefined;
            const selected = selectedId === e.id;
            const clasif = (e.clasificacion && CLASIF_COLOR[e.clasificacion]) || { fg: colors.textFaint, bg: '#F1F4F8' };
            return (
              <div
                key={e.id}
                onClick={() => onSelect(e)}
                style={{
                  background: selected ? colors.blueBg : '#fff',
                  border: `1px solid ${selected ? colors.blue : colors.border}`, borderRadius: 10, padding: '12px 14px',
                  cursor: 'pointer', transition: 'border-color 180ms, background 180ms',
                }}
              >
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: colors.blueBg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: colors.blueDark, flexShrink: 0 }}>
                    {(e.cliente_nombre || '?').charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.cliente_nombre || 'Cliente sin identificar'}</div>
                      <div style={{ fontSize: 10.5, color: colors.textFaint, flexShrink: 0 }}>{horaDe(e.recibido_at)}</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.asunto}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: clasif.fg, background: clasif.bg, borderRadius: 5, padding: '3px 8px' }}>
                        {e.clasificacion ? CLASIF_LABEL[e.clasificacion] || e.clasificacion : 'Sin clasificar'}
                      </span>
                      {factura && <span style={{ fontSize: 11, fontWeight: 700, color: colors.textStrong }}>{money(factura.saldo_pendiente)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {visibles.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: colors.textFaint, textAlign: 'center' }}>No hay comunicaciones que coincidan.</div>}
        </div>
      </div>

      <div style={{ padding: '10px 16px', borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: colors.textFaint }}>Mostrando {visibles.length} de {filtrados.length} comunicaciones</span>
        {(filtro !== 'TODOS' || search) && (
          <span onClick={() => { onFiltro('TODOS'); onSearch(''); }} style={{ fontSize: 11, color: colors.blueDark, cursor: 'pointer', fontWeight: 600 }}>Ver todas →</span>
        )}
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      {children}
    </div>
  );
}
