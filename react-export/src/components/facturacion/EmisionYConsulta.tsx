import { useState } from 'react';
import { colors } from '../../lib/styles';
import EmisionCompacta from './EmisionCompacta';
import EmisionDrawer from './EmisionDrawer';
import FacturacionAssistant from './FacturacionAssistant';
import type { Emision, IntentContext } from './facturacionIntents';

/** Panel 4 de Facturacion: emision operativa (zona superior, ~40%) + asistente
 * conversacional especializado (zona inferior, ~60%), en una unica card. */
export default function EmisionYConsulta({
  emision, filtroTipoFactura, onFiltro, onEmitir, contexto,
}: {
  emision: Emision[]; filtroTipoFactura: string; onFiltro: (v: string) => void; onEmitir: (id: string) => void;
  contexto: IntentContext;
}) {
  const [verTodas, setVerTodas] = useState(false);

  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, minWidth: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)', minHeight: 680, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong }}>Emisión &amp; Consulta</div>
        <div style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 2 }}>Opera las facturas listas y consulta el contexto completo de Facturación.</div>
      </div>
      <div style={{ flex: '0 0 40%', minHeight: 0, overflow: 'hidden' }}>
        <EmisionCompacta emision={emision} filtroTipoFactura={filtroTipoFactura} onFiltro={onFiltro} onEmitir={onEmitir} onVerTodas={() => setVerTodas(true)} />
      </div>
      <div style={{ borderTop: `1px solid ${colors.borderLight}`, flex: '1 1 60%', minHeight: 0, overflow: 'hidden' }}>
        <FacturacionAssistant contexto={contexto} />
      </div>

      <EmisionDrawer open={verTodas} onClose={() => setVerTodas(false)} emision={emision} filtroTipoFactura={filtroTipoFactura} onFiltro={onFiltro} onEmitir={onEmitir} />
    </div>
  );
}
