import { colors, monoFont } from '../../lib/styles';
import type { Detalle } from './cliente360Logic';

function iniciales(nombre: string): string {
  const partes = nombre.replace(/[_.]/g, ' ').trim().split(/\s+/).filter(Boolean);
  // Identificadores tipo "CLIENT_00435" no tienen un segundo "nombre" real:
  // se usan las 2 primeras letras de la parte alfabética en vez de letra+digito.
  if (partes.length < 2 || /^\d+$/.test(partes[1])) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function ClienteHeader({ detalle, onVerTrazabilidad, onExportar, onAbrirCuenta }: {
  detalle: Detalle; onVerTrazabilidad: () => void; onExportar: () => void; onAbrirCuenta: () => void;
}) {
  const { cliente } = detalle;
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: colors.blueBg, color: colors.blueDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
          {iniciales(cliente.razon_social)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.razon_social}</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: cliente.activo ? colors.greenDark : colors.textMuted, background: cliente.activo ? colors.greenBg : '#F1F4F8', borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>
              {cliente.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div style={{ ...monoFont, fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
            RUC {cliente.numero_identificacion_fiscal} · {cliente.segmento_pais || 'Segmento sin definir'} · COD_CLIENTE: {cliente.id.slice(0, 8).toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onVerTrazabilidad} style={btnLight}>Ver trazabilidad</button>
        <button onClick={onExportar} style={{ ...btnLight, display: 'flex', alignItems: 'center', gap: 6 }}>Exportar <span style={{ fontSize: 9 }}>▾</span></button>
        <button onClick={onAbrirCuenta} style={btnDark}>Abrir cuenta</button>
      </div>
    </div>
  );
}

const btnLight: React.CSSProperties = { height: 36, padding: '0 14px', borderRadius: 7, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
const btnDark: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
