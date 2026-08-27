import { colors } from '../../lib/styles';
import { formatValue, type ChartSpec } from './charts';

/** Bar chart generico: cualquier metrica/dimension puede alimentarlo con solo
 * cambiar `spec.data` (seccion 10 del prompt: metric/dimension/timeRange). */
export default function BarMetricChart({ spec, onReset }: { spec: ChartSpec; onReset?: () => void }) {
  const max = Math.max(1, ...spec.data.map((d) => d.value));

  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong }}>{spec.title}</div>
          {spec.subtitle && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>{spec.subtitle}</div>}
        </div>
        {onReset && (
          <span onClick={onReset} style={{ fontSize: 11, color: colors.blueDark, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>Restablecer vista</span>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: Math.max(8, 28 - spec.data.length), padding: '0 4px', overflowX: 'auto' }}>
        {spec.data.map((d) => {
          const h = Math.max(4, (d.value / max) * 130);
          return (
            <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 0 auto' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: colors.textStrong, whiteSpace: 'nowrap' }}>{formatValue(d.value, spec.format)}</div>
              <div style={{ width: 38, height: h, background: colors.blue, borderRadius: '4px 4px 0 0' }} />
              <div style={{ fontSize: 10.5, color: colors.textMuted, whiteSpace: 'nowrap', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.label}>{d.label}</div>
            </div>
          );
        })}
        {spec.data.length === 0 && <div style={{ fontSize: 12.5, color: colors.textFaint, margin: 'auto' }}>Sin datos para mostrar.</div>}
      </div>
    </div>
  );
}
