import { motion } from 'motion/react';
import { colors } from '../../lib/styles';
import type { AgentEvent } from '../../types/agents';
import { motionTokens, prefersReducedMotion } from '../../lib/motionTokens';

const SEVERITY_COLOR: Record<NonNullable<AgentEvent['severity']>, string> = {
  normal: colors.blue,
  success: colors.greenDark,
  warning: colors.amberDark,
  critical: colors.redDark,
};

/** Paquete visual que viaja de un agente a otro sobre el Mapa Vivo — representa
 * un evento machine-to-machine real (handoff, notificación, dato compartido). */
export default function EventPacket({
  fromPct,
  toPct,
  color,
  onArrive,
}: {
  fromPct: { x: number; y: number };
  toPct: { x: number; y: number };
  color?: AgentEvent['severity'];
  onArrive?: () => void;
}) {
  const reduced = prefersReducedMotion();
  const fill = SEVERITY_COLOR[color || 'normal'];

  return (
    <motion.div
      initial={{ left: `${fromPct.x}%`, top: `${fromPct.y}%`, opacity: 0, scale: 0.6 }}
      animate={{ left: `${toPct.x}%`, top: `${toPct.y}%`, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={reduced ? { duration: 0.01 } : motionTokens.packet}
      onAnimationComplete={onArrive}
      style={{
        position: 'absolute',
        width: 10,
        height: 10,
        marginLeft: -5,
        marginTop: -5,
        borderRadius: '50%',
        background: fill,
        boxShadow: `0 0 0 4px ${fill}22, 0 0 10px ${fill}88`,
        zIndex: 3,
        pointerEvents: 'none',
      }}
    />
  );
}
