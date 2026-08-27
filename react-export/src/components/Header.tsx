import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Conectividad = 'checking' | 'ok' | 'down';

/** "Operación conectada" (seccion 9): estado real del backend, no decorativo —
 * si Supabase/el backend se cae durante una demo, esto lo refleja de inmediato. */
function useConectividad(): Conectividad {
  const [estado, setEstado] = useState<Conectividad>('checking');
  useEffect(() => {
    let vivo = true;
    const chequear = () => {
      api.get<{ status: string }>('/').then((r) => { if (vivo) setEstado(r.status === 'ok' ? 'ok' : 'down'); }).catch(() => { if (vivo) setEstado('down'); });
    };
    chequear();
    const id = setInterval(chequear, 30000);
    return () => { vivo = false; clearInterval(id); };
  }, []);
  return estado;
}

const ESTADO_LABEL: Record<Conectividad, string> = {
  checking: 'Verificando conexión…',
  ok: 'Operación conectada',
  down: 'Backend no disponible',
};
const ESTADO_COLOR: Record<Conectividad, string> = { checking: '#94A3B8', ok: '#16A34A', down: '#DC2626' };

export default function Header({ onOpenTraza }: { onOpenTraza: () => void }) {
  const conectividad = useConectividad();
  return (
    <div
      style={{
        height: 60, flexShrink: 0,
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(14px) saturate(180%)',
        WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        borderBottom: '1px solid rgba(15,23,42,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', gap: 20,
        position: 'sticky', top: 0, zIndex: 10,
      }}
    >
      <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
        <input
          type="text"
          aria-label="Buscar cliente, cuenta o factura"
          placeholder="Buscar cliente, cuenta o factura..."
          style={{ width: '100%', height: 36, border: '1px solid #E2E5EA', background: '#F5F7FA', borderRadius: 7, padding: '0 14px', fontSize: 13, color: '#1A2433', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475467', fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: ESTADO_COLOR[conectividad], flexShrink: 0 }} aria-hidden="true" />
          {ESTADO_LABEL[conectividad]}
        </div>
        <button
          aria-label="Notificaciones"
          style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid #E2E5EA', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, cursor: 'pointer' }}
        >
          <div style={{ width: 14, height: 14, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', border: '1.6px solid #475467', borderBottom: 'none', position: 'relative' }} />
          <div style={{ position: 'absolute', top: 6, right: 7, width: 6, height: 6, background: '#DC2626', borderRadius: '50%', border: '1.5px solid #fff' }} />
        </button>
        <button
          onClick={onOpenTraza}
          style={{ height: 36, padding: '0 15px', borderRadius: 7, border: '1px solid #2E6CE8', background: '#EAF1FC', color: '#2050C4', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          ✦ Preguntar a TRAZA
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2E6CE8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>AT</div>
      </div>
    </div>
  );
}
