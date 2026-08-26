import type { CSSProperties, ReactNode } from 'react';

/** Reusable lateral drawer shell used across every module (service detail, invoice trace, case analysis, etc.) */
export default function Drawer({
  open,
  onClose,
  width = 440,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 40 };
  const panel: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width,
    background: '#fff',
    zIndex: 41,
    boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
  };
  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div style={panel}>
        <div style={{ padding: '22px 22px 16px', borderBottom: '1px solid #E2E5EA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{title}</div>
            <div onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, color: '#94A3B8', lineHeight: 1, flexShrink: 0 }}>×</div>
          </div>
          {subtitle && <div style={{ marginTop: 6 }}>{subtitle}</div>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>{children}</div>
        {footer && <div style={{ padding: '18px 22px', borderTop: '1px solid #E2E5EA', display: 'flex', flexDirection: 'column', gap: 8 }}>{footer}</div>}
      </div>
    </>
  );
}
