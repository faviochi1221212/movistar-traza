import { AnimatePresence } from 'motion/react';
import AgentNode from '../agents/AgentNode';
import AgentConnection from '../agents/AgentConnection';
import EventPacket from '../agents/EventPacket';
import type { AgentId, AgentStatus, AgentEvent } from '../../types/agents';

export const NODE_POS: Record<AgentId, { x: number; y: number }> = {
  orchestrator: { x: 50, y: 10 },
  billing: { x: 14, y: 50 },
  collections: { x: 50, y: 50 },
  revenue: { x: 86, y: 50 },
  bi: { x: 50, y: 90 },
};

const EDGES: { a: AgentId; b: AgentId; dashed?: boolean }[] = [
  { a: 'orchestrator', b: 'billing' },
  { a: 'orchestrator', b: 'collections' },
  { a: 'orchestrator', b: 'revenue' },
  { a: 'orchestrator', b: 'bi' },
  { a: 'billing', b: 'collections' },
  { a: 'collections', b: 'revenue' },
  { a: 'revenue', b: 'bi' },
  { a: 'bi', b: 'collections', dashed: true },
];

export type FlightPacket = { id: string; from: AgentId; to: AgentId; severity: AgentEvent['severity'] };

export default function OrchestrationMap({
  statuses,
  activeEdges,
  packets,
  onNodeClick,
  onPacketArrive,
}: {
  statuses: Record<AgentId, AgentStatus>;
  activeEdges: Set<string>;
  packets: FlightPacket[];
  onNodeClick: (id: AgentId) => void;
  onPacketArrive: (id: string) => void;
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: 440 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {EDGES.map((e) => {
          const p1 = NODE_POS[e.a];
          const p2 = NODE_POS[e.b];
          const key = `${e.a}-${e.b}`;
          return (
            <AgentConnection
              key={key}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              dashed={e.dashed}
              active={activeEdges.has(key) || activeEdges.has(`${e.b}-${e.a}`)}
            />
          );
        })}
      </svg>

      <AnimatePresence>
        {packets.map((pk) => (
          <EventPacket
            key={pk.id}
            fromPct={NODE_POS[pk.from]}
            toPct={NODE_POS[pk.to]}
            color={pk.severity}
            onArrive={() => onPacketArrive(pk.id)}
          />
        ))}
      </AnimatePresence>

      {(Object.keys(NODE_POS) as AgentId[]).map((id) => (
        <AgentNode key={id} id={id} status={statuses[id]} xPct={NODE_POS[id].x} yPct={NODE_POS[id].y} onClick={onNodeClick} />
      ))}
    </div>
  );
}
