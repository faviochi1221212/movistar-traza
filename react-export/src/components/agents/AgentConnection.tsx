import { colors } from '../../lib/styles';

export default function AgentConnection({
  x1,
  y1,
  x2,
  y2,
  active,
  dashed,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  dashed?: boolean;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={active ? colors.blue : colors.border}
      strokeWidth={active ? 0.5 : 0.35}
      strokeDasharray={dashed ? '2 2' : undefined}
      style={{ transition: 'stroke 0.4s ease, stroke-width 0.4s ease' }}
    />
  );
}
