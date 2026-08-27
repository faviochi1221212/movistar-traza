import { colors } from '../../lib/styles';
import { formatValue, type ChartSpec } from './charts';

const W = 100;
const H = 100;
const PAD = 8;

/** Line chart generico via SVG (sin dependencias externas): mismo contrato de
 * spec.data que BarMetricChart, listo para reemplazar metric/dimension. */
export default function LineMetricChart({ spec, onReset }: { spec: ChartSpec; onReset?: () => void }) {
  const values = spec.data.map((d) => d.value);
  const max = Math.max(...values, spec.format === 'percent' ? 1 : 0.0001);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = spec.data.map((d, i) => {
    const x = spec.data.length > 1 ? PAD + (i / (spec.data.length - 1)) * (W - PAD * 2) : W / 2;
    const y = H - PAD - ((d.value - min) / range) * (H - PAD * 2);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

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
      {spec.data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 12.5, color: colors.textFaint }}>Sin datos para mostrar.</span></div>
      ) : (
        <div style={{ flex: 1, position: 'relative', minHeight: 130 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d={path} fill="none" stroke={colors.blue} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
            {points.map((p) => (
              <circle key={p.label} cx={p.x} cy={p.y} r={1.6} fill={colors.blue} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div style={{ position: 'absolute', bottom: -22, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: `0 ${PAD}%` }}>
            {spec.data.map((d) => <span key={d.label} style={{ fontSize: 10.5, color: colors.textMuted }}>{d.label}</span>)}
          </div>
        </div>
      )}
      <div style={{ marginTop: 30, fontSize: 12.5, fontWeight: 700, color: colors.textStrong }}>
        {spec.data.length > 0 && formatValue(spec.data[spec.data.length - 1].value, spec.format)}
        {spec.data.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: colors.textMuted, marginLeft: 6 }}>último dato</span>}
      </div>
    </div>
  );
}
