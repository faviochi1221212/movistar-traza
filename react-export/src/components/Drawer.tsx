import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { motionTokens, prefersReducedMotion } from '../lib/motionTokens';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
    outline: 'none',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            style={overlay}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTokens.crossfade}
          />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            style={panel}
            initial={{ x: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 }}
            transition={motionTokens.sheet}
          >
            <div style={{ padding: '22px 22px 16px', borderBottom: '1px solid #E2E5EA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{title}</div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  style={{ cursor: 'pointer', fontSize: 18, color: '#94A3B8', lineHeight: 1, flexShrink: 0, background: 'none', border: 'none', padding: 0 }}
                >
                  ×
                </button>
              </div>
              {subtitle && <div style={{ marginTop: 6 }}>{subtitle}</div>}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>{children}</div>
            {footer && <div style={{ padding: '18px 22px', borderTop: '1px solid #E2E5EA', display: 'flex', flexDirection: 'column', gap: 8 }}>{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
