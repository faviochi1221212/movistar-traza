import { colors } from '../../lib/styles';

/** Maximo 3 observaciones analiticas (seccion 11 del prompt): discretas, sin
 * alertas gigantes, cada una calculada desde datos reales por el padre. */
export default function BIInsights({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Insights de TRAZA</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.slice(0, 3).map((t, i) => (
          <div key={i} style={{ fontSize: 13, color: colors.text, lineHeight: 1.5, display: 'flex', gap: 8 }}>
            <span style={{ color: colors.blue, flexShrink: 0 }}>•</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
