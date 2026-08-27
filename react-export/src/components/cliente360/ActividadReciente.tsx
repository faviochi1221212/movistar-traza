import { colors } from '../../lib/styles';
import { actividadReciente, eventoLabel, type Detalle } from './cliente360Logic';

export default function ActividadReciente({ detalle, onVerHistorial }: { detalle: Detalle; onVerHistorial: () => void }) {
  const eventos = actividadReciente(detalle);
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Última actividad</div>
        <span onClick={onVerHistorial} style={{ fontSize: 12, color: colors.blueDark, fontWeight: 600, cursor: 'pointer' }}>Ver historial</span>
      </div>
      {eventos.length === 0 ? (
        <div style={{ fontSize: 12.5, color: colors.textFaint }}>Sin actividad reciente registrada.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${eventos.length}, 1fr)`, gap: 16 }}>
          {eventos.map((e, i) => (
            <div key={i} style={{ borderLeft: `2px solid ${colors.blue}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 11, color: colors.textFaint, fontWeight: 600 }}>{eventoLabel(e.timestamp)}</div>
              <div style={{ fontSize: 12.5, color: colors.text, marginTop: 3, lineHeight: 1.4 }}>{e.texto}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
