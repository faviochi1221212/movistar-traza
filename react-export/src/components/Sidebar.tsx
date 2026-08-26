import { NavLink } from 'react-router-dom';
import type { CSSProperties } from 'react';

const NAV_OP = [
  { to: '/centro', label: 'Centro de Control', icon: 'grid' },
  { to: '/facturacion', label: 'Facturación', icon: 'doc' },
  { to: '/cobranzas', label: 'Cobranzas & Recaudo', icon: 'money' },
  { to: '/bi', label: 'BI & Recupero', icon: 'diamond' },
  { to: '/cliente360', label: 'Cliente 360', icon: 'circle' },
];
const NAV_CONTROL = [
  { to: '/auditoria', label: 'Auditoría', icon: 'list' },
  { to: '/configuracion', label: 'Configuración', icon: 'grid' },
];

function Icon({ kind }: { kind: string }) {
  const base: CSSProperties = { width: 14, height: 14, flexShrink: 0 };
  if (kind === 'grid') return <div style={{ ...base, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
    <span style={{ background: 'currentColor', borderRadius: 1 }} /><span style={{ background: 'currentColor', borderRadius: 1 }} />
    <span style={{ background: 'currentColor', borderRadius: 1 }} /><span style={{ background: 'currentColor', borderRadius: 1 }} />
  </div>;
  if (kind === 'doc') return <div style={{ ...base, border: '1.6px solid currentColor', borderRadius: 2 }} />;
  if (kind === 'money') return <div style={{ ...base, border: '1.6px solid currentColor', borderRadius: '50%' }} />;
  if (kind === 'diamond') return <div style={{ ...base, border: '1.6px solid currentColor', transform: 'rotate(45deg)' }} />;
  if (kind === 'circle') return <div style={{ ...base, border: '1.6px solid currentColor', borderRadius: '50%' }} />;
  return <div style={{ ...base, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
    <span style={{ height: 1.6, background: 'currentColor' }} /><span style={{ height: 1.6, background: 'currentColor' }} /><span style={{ height: 1.6, background: 'currentColor' }} />
  </div>;
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }): CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 38,
        padding: '0 10px',
        borderRadius: 7,
        marginBottom: 2,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
        cursor: 'pointer',
        color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
        background: isActive ? 'rgba(46,108,232,0.25)' : 'transparent',
      })}
    >
      <Icon kind={icon} />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <div style={{ width: 236, flexShrink: 0, background: '#071E36', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 30, height: 30, flexShrink: 0, background: '#2E6CE8', transform: 'rotate(45deg)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 10, height: 10, background: '#fff', transform: 'rotate(-45deg)', borderRadius: 2 }} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: 0.5, lineHeight: 1.1 }}>TRAZA</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Operaciones de Telecom</div>
        </div>
      </div>

      <div style={{ padding: '18px 12px 6px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8, color: 'rgba(255,255,255,0.35)', padding: '0 10px', marginBottom: 6 }}>OPERACIÓN</div>
        {NAV_OP.map((item) => <NavItem key={item.to} {...item} />)}

        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8, color: 'rgba(255,255,255,0.35)', padding: '0 10px', margin: '18px 0 6px' }}>CONTROL</div>
        {NAV_CONTROL.map((item) => <NavItem key={item.to} {...item} />)}
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
        v2.4.1 · Entorno Producción
      </div>
    </div>
  );
}
