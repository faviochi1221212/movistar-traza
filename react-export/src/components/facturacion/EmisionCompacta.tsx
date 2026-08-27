import { colors, monoFont } from '../../lib/styles';
import { money } from '../../lib/api';
import FilterSelect from '../FilterSelect';
import type { Emision } from './facturacionIntents';

function tagBox(s: { color: string; bg: string }) {
  return { display: 'inline-block', fontSize: 10.5, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 5, padding: '3px 7px' } as const;
}

export default function EmisionCompacta({
  emision, filtroTipoFactura, onFiltro, onEmitir, onVerTodas,
}: {
  emision: Emision[]; filtroTipoFactura: string; onFiltro: (v: string) => void; onEmitir: (id: string) => void; onVerTodas: () => void;
}) {
  const listas = emision.filter((e) => e.puede_emitir);
  const bloqueadas = emision.filter((e) => !e.puede_emitir);
  const visibles = emision.slice(0, 3);

  return (
    <div style={{ padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, marginBottom: 10 }}>Emisión</div>
      <FilterSelect label="Tipo" value={filtroTipoFactura} onChange={onFiltro} options={[
        { value: 'TODOS', label: 'Todos' }, { value: 'CICLICA', label: 'Cíclica' }, { value: 'ACICLICA', label: 'Acíclica' },
      ]} />
      <div style={{ display: 'flex', gap: 20, margin: '14px 0 12px' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: colors.greenDark }}>{listas.length}</div>
          <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>Listas</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: colors.redDark }}>{bloqueadas.length}</div>
          <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>Bloqueadas</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibles.map((e) => (
          <div key={e.id} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 7, padding: '9px 11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ ...monoFont, fontSize: 12, fontWeight: 600, color: colors.textStrong }}>{e.cliente_nombre}</div>
              <span style={tagBox(e.tipo_factura === 'CICLICA' ? { color: colors.greenDark, bg: colors.greenBg } : { color: colors.blueDark, bg: colors.blueBg })}>{e.tipo_factura === 'CICLICA' ? 'Cíclica' : 'Acíclica'}</span>
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{e.numero} · {money(e.monto)}</div>
            <div style={{ marginTop: 7 }}>
              {e.puede_emitir
                ? <button onClick={() => onEmitir(e.id)} style={{ width: '100%', height: 27, borderRadius: 6, border: 'none', background: colors.navy, color: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Emitir</button>
                : <span style={{ textAlign: 'center', ...tagBox({ color: colors.redDark, bg: colors.redBg }), display: 'block' }} title={e.motivo}>Bloqueada</span>}
            </div>
          </div>
        ))}
        {emision.length === 0 && (
          <div style={{ padding: '18px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong }}>No hay facturas pendientes</div>
            <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>Todas las facturas procesadas ya fueron emitidas o requieren revisión.</div>
          </div>
        )}
      </div>

      {emision.length > 0 && (
        <div onClick={onVerTodas} style={{ fontSize: 11.5, color: colors.blueDark, cursor: 'pointer', fontWeight: 600, marginTop: 10 }}>
          Ver todas las facturas ({emision.length}) →
        </div>
      )}
    </div>
  );
}
