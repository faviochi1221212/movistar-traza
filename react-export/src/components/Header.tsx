export default function Header({ onOpenTraza }: { onOpenTraza: () => void }) {
  return (
    <div style={{ height: 60, flexShrink: 0, background: '#fff', borderBottom: '1px solid #E2E5EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', gap: 20 }}>
      <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
        <input
          type="text"
          placeholder="Buscar cliente, cuenta o factura..."
          style={{ width: '100%', height: 36, border: '1px solid #E2E5EA', background: '#F5F7FA', borderRadius: 7, padding: '0 14px', fontSize: 13, color: '#1A2433', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ fontSize: 12.5, color: '#475467', background: '#F5F7FA', border: '1px solid #E2E5EA', borderRadius: 6, padding: '7px 12px', fontWeight: 500 }}>Jul 2026</div>
        <div style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid #E2E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', border: '1.6px solid #475467', borderBottom: 'none', position: 'relative' }} />
          <div style={{ position: 'absolute', top: 6, right: 7, width: 6, height: 6, background: '#DC2626', borderRadius: '50%', border: '1.5px solid #fff' }} />
        </div>
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
