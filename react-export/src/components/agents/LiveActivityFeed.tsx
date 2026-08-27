import { AnimatePresence, motion } from 'motion/react';
import { colors, monoFont } from '../../lib/styles';
import type { AgentEvent } from '../../types/agents';
import { AGENT_LABEL } from '../../types/agents';
import { motionTokens, prefersReducedMotion } from '../../lib/motionTokens';

const SEVERITY_DOT: Record<NonNullable<AgentEvent['severity']>, string> = {
  normal: colors.blue,
  success: colors.greenDark,
  warning: colors.amberDark,
  critical: colors.redDark,
};

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Bitácora en vivo de eventos machine-to-machine — el "qué está pasando ahora"
 * del ciclo de ingreso, no un log técnico: cada línea es una decisión u observación. */
export default function LiveActivityFeed({ events }: { events: AgentEvent[] }) {
  const reduced = prefersReducedMotion();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 420, overflowY: 'auto' }}>
      <AnimatePresence initial={false}>
        {events.map((e) => (
          <motion.div
            key={e.id}
            layout={!reduced}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={motionTokens.default}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 4px', borderBottom: `1px solid ${colors.borderLight}` }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEVERITY_DOT[e.severity || 'normal'], marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: colors.text, lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700, color: colors.textStrong }}>{AGENT_LABEL[e.source]}</span>
                {e.target && <span style={{ color: colors.textMuted }}> → {AGENT_LABEL[e.target]}</span>}
                {'  '}
                {e.title}
              </div>
              {e.detail && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>{e.detail}</div>}
            </div>
            <span style={{ ...monoFont, fontSize: 10.5, color: colors.textFaint, flexShrink: 0, marginTop: 1 }}>{hora(e.timestamp)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {events.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textFaint, padding: '20px 4px' }}>
          Sin actividad de agentes todavía. Pulsa «Procesar ciclo» para ver el ciclo de ingreso en acción.
        </div>
      )}
    </div>
  );
}
