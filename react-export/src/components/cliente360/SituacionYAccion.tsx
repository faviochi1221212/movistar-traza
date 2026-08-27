import { colors } from '../../lib/styles';
import { situacionActual, accionRecomendada, casoDestacado, type Detalle } from './cliente360Logic';

function chip(texto: string, color: string, bg: string) {
  return <span key={texto} style={{ fontSize: 11, fontWeight: 600, color, background: bg, borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>{texto}</span>;
}

export default function SituacionYAccion({ detalle, onIrAConciliacion }: { detalle: Detalle; onIrAConciliacion: () => void }) {
  const situacion = situacionActual(detalle);
  const accion = accionRecomendada(detalle);
  const caso = casoDestacado(detalle);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ color: colors.amberDark, fontSize: 15 }}>◐</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong }}>Situación actual</div>
        </div>
        <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, marginBottom: 14 }}>{situacion.texto}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {situacion.chips.map((c) => chip(c, colors.textMuted, '#F1F4F8'))}
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ color: colors.greenDark, fontSize: 15 }}>✓</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong }}>Acción recomendada</div>
        </div>
        <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, marginBottom: 14 }}>{accion.texto}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {accion.categorias.map((c) => chip(c, colors.blueDark, colors.blueBg))}
        </div>
        {caso && (
          <button onClick={onIrAConciliacion} style={{ width: '100%', height: 38, borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            Ir a conciliación
          </button>
        )}
      </div>
    </div>
  );
}
