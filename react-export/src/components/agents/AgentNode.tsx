import { motion } from 'motion/react';
import { colors } from '../../lib/styles';
import type { AgentId, AgentStatus } from '../../types/agents';
import { AGENT_LABEL } from '../../types/agents';
import { motionTokens, prefersReducedMotion } from '../../lib/motionTokens';

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: colors.textFaint,
  processing: colors.blue,
  waiting: colors.amberDark,
  attention: colors.redDark,
  completed: colors.greenDark,
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'En espera',
  processing: 'Procesando',
  waiting: 'Esperando respuesta',
  attention: 'Requiere atención',
  completed: 'Completado',
};

export default function AgentNode({
  id,
  status,
  xPct,
  yPct,
  size = 84,
  onClick,
}: {
  id: AgentId;
  status: AgentStatus;
  xPct: number;
  yPct: number;
  size?: number;
  onClick?: (id: AgentId) => void;
}) {
  const ring = STATUS_COLOR[status];
  const reduced = prefersReducedMotion();
  const pulsing = status === 'processing';

  return (
    <div
      onClick={() => onClick?.(id)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${AGENT_LABEL[id]} — ${STATUS_LABEL[status]}` : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(id); }
      }}
      style={{
        position: 'absolute',
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: onClick ? 'pointer' : 'default',
        zIndex: 2,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        {pulsing && !reduced && (
          <motion.div
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${ring}` }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.div
          animate={{ borderColor: ring, boxShadow: status === 'attention' ? `0 0 0 4px ${colors.redBg}` : '0 0 0 0px rgba(0,0,0,0)' }}
          transition={motionTokens.default}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: '#fff',
            border: `2.5px solid ${ring}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: colors.textStrong,
            textAlign: 'center',
            padding: 4,
          }}
        >
          {AGENT_LABEL[id]}
        </motion.div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 999, padding: '3px 9px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ring, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: colors.textMuted, whiteSpace: 'nowrap' }}>{STATUS_LABEL[status]}</span>
      </div>
    </div>
  );
}
