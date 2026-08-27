import { colors, monoFont } from '../../lib/styles';
import { money, fecha, fechaHora } from '../../lib/api';
import { clasifLabel, estadoLabel, type Detalle } from './cliente360Logic';

function tagBox(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-block', fontSize: 11, fontWeight: 600, color, background: bg, borderRadius: 5, padding: '3px 9px' };
}

export function FacturacionTab({ detalle }: { detalle: Detalle }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border}`, fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Todas las facturas ({detalle.facturas.length})</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            <th style={th('left')}>DOCUMENTO</th><th style={th('left')}>TIPO</th><th style={th('right')}>MONTO</th>
            <th style={th('left')}>ESTADO</th><th style={th('left')}>EMISIÓN</th>
          </tr>
        </thead>
        <tbody>
          {detalle.facturas.map((f) => (
            <tr key={f.id}>
              <td style={{ ...td, ...monoFont, fontSize: 12.5, fontWeight: 600, color: colors.textStrong }}>{f.numero}</td>
              <td style={td}><span style={tagBox(f.tipo_factura === 'CICLICA' ? colors.greenDark : colors.blueDark, f.tipo_factura === 'CICLICA' ? colors.greenBg : colors.blueBg)}>{f.tipo_factura === 'CICLICA' ? 'Cíclica' : 'Acíclica'}</span></td>
              <td style={{ ...td, fontSize: 12.5, fontWeight: 600, color: colors.textStrong, textAlign: 'right' }}>{money(f.monto)}</td>
              <td style={{ ...td, fontSize: 12, color: colors.text }}>{estadoLabel(f.estado)}</td>
              <td style={{ ...td, fontSize: 12, color: colors.textMuted }}>{fecha(f.fecha_emision)}</td>
            </tr>
          ))}
          {detalle.facturas.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', fontSize: 12.5, color: colors.textFaint }}>Sin facturas registradas.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function CobranzaTab({ detalle }: { detalle: Detalle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border}`, fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Comunicaciones ({detalle.comunicaciones.length})</div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {detalle.comunicaciones.map((c) => (
            <div key={c.id} style={{ padding: '12px 18px', borderBottom: `1px solid ${colors.borderLight}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.textStrong }}>{c.asunto}</div>
                <span style={tagBox(colors.textMuted, '#F1F4F8')}>{clasifLabel(c.clasificacion)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 4 }}>{fechaHora(c.recibido_at)}</div>
            </div>
          ))}
          {detalle.comunicaciones.length === 0 && <div style={{ padding: 18, textAlign: 'center', fontSize: 12.5, color: colors.textFaint }}>Sin comunicaciones registradas.</div>}
        </div>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border}`, fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Casos de cobranza ({detalle.casos_cobranza.length})</div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {detalle.casos_cobranza.map((c: any) => (
            <div key={c.id} style={{ padding: '12px 18px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12.5, color: colors.text }}>{c.asunto || c.descripcion}</div>
          ))}
          {detalle.casos_cobranza.length === 0 && <div style={{ padding: 18, textAlign: 'center', fontSize: 12.5, color: colors.textFaint }}>Sin casos de cobranza abiertos.</div>}
        </div>
      </div>
    </div>
  );
}

export function BiTab({ detalle }: { detalle: Detalle }) {
  const r = detalle.resumen;
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 22 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong, marginBottom: 16 }}>Lectura de BI sobre esta cuenta</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
        <MiniStat label="Probabilidad de pago" value={r?.probabilidad_pago != null ? `${(r.probabilidad_pago * 100).toFixed(0)}%` : '—'} />
        <MiniStat label="Nivel de riesgo" value={r?.nivel_riesgo || 'Sin evaluar'} />
        <MiniStat label="Días promedio de pago" value={detalle.dias_promedio_pago != null ? `${detalle.dias_promedio_pago} días` : '—'} />
      </div>
      <div style={{ fontSize: 12.5, color: colors.text, lineHeight: 1.6, background: '#F8FAFC', borderRadius: 8, padding: '14px 16px' }}>
        {detalle.dias_promedio_pago != null
          ? `Con base en el historial de pagos, ${detalle.cliente.razon_social} suele pagar ${detalle.dias_promedio_pago} días después de emitida la factura, y el modelo lo clasifica con riesgo ${r?.nivel_riesgo || 'sin evaluar'}.`
          : 'Todavía no hay suficientes pagos históricos para generar un patrón de comportamiento confiable.'}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: colors.textStrong, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const td: React.CSSProperties = { padding: '10px 14px', borderBottom: `1px solid ${colors.borderLight}` };
function th(align: 'left' | 'right'): React.CSSProperties {
  return { textAlign: align, fontSize: 10.5, fontWeight: 600, color: colors.textMuted, letterSpacing: 0.3, padding: '9px 14px', borderBottom: `1px solid ${colors.border}` };
}
