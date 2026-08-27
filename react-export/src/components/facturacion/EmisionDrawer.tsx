import { colors, monoFont } from '../../lib/styles';
import { money } from '../../lib/api';
import Drawer from '../Drawer';
import FilterSelect from '../FilterSelect';
import type { Emision } from './facturacionIntents';

function tagBox(s: { color: string; bg: string }) {
  return { display: 'inline-block', fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 6, padding: '4px 9px' } as const;
}

export default function EmisionDrawer({
  open, onClose, emision, filtroTipoFactura, onFiltro, onEmitir,
}: {
  open: boolean; onClose: () => void; emision: Emision[]; filtroTipoFactura: string; onFiltro: (v: string) => void; onEmitir: (id: string) => void;
}) {
  const listas = emision.filter((e) => e.puede_emitir);
  const bloqueadas = emision.filter((e) => !e.puede_emitir);

  return (
    <Drawer
      open={open} onClose={onClose} width={480} title="Todas las facturas en emisión"
      subtitle={<div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 4 }}>{emision.length} documentos en proceso de emisión.</div>}
    >
      <div style={{ marginBottom: 22 }}>
        <FilterSelect label="Tipo" value={filtroTipoFactura} onChange={onFiltro} options={[
          { value: 'TODOS', label: 'Todos' }, { value: 'CICLICA', label: 'Cíclica' }, { value: 'ACICLICA', label: 'Acíclica' },
        ]} />
      </div>

      {emision.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: colors.textFaint }}>No hay facturas en proceso de emisión.</div>
      ) : (
        <>
          {listas.length > 0 && <Grupo titulo="Listas para emitir" cantidad={listas.length} color={colors.greenDark} facturas={listas} onEmitir={onEmitir} />}
          {bloqueadas.length > 0 && <Grupo titulo="Bloqueadas" cantidad={bloqueadas.length} color={colors.redDark} facturas={bloqueadas} onEmitir={onEmitir} />}
        </>
      )}
    </Drawer>
  );
}

function Grupo({ titulo, cantidad, color, facturas, onEmitir }: { titulo: string; cantidad: number; color: string; facturas: Emision[]; onEmitir: (id: string) => void }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{titulo} · {cantidad}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {facturas.map((e) => <FacturaCard key={e.id} e={e} onEmitir={onEmitir} />)}
      </div>
    </div>
  );
}

function FacturaCard({ e, onEmitir }: { e: Emision; onEmitir: (id: string) => void }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong }}>{e.cliente_nombre}</div>
          <div style={{ ...monoFont, fontSize: 12, color: colors.textMuted, marginTop: 3 }}>{e.numero}</div>
        </div>
        <span style={tagBox(e.tipo_factura === 'CICLICA' ? { color: colors.greenDark, bg: colors.greenBg } : { color: colors.blueDark, bg: colors.blueBg })}>
          {e.tipo_factura === 'CICLICA' ? 'Cíclica' : 'Acíclica'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: colors.textStrong }}>{money(e.monto)}</div>
        {e.puede_emitir
          ? <button onClick={() => onEmitir(e.id)} style={{ height: 32, padding: '0 16px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Emitir</button>
          : <span style={tagBox({ color: colors.redDark, bg: colors.redBg })} title={e.motivo}>Bloqueada</span>}
      </div>
      {!e.puede_emitir && e.motivo && (
        <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 8 }}>{e.motivo}</div>
      )}
    </div>
  );
}
