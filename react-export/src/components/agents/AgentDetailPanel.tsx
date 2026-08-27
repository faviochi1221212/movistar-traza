import Drawer from '../Drawer';
import { colors } from '../../lib/styles';
import type { AgentEvent, AgentId, AgentStatus } from '../../types/agents';
import { AGENT_LABEL } from '../../types/agents';

const DESCRIPCION: Record<AgentId, string> = {
  orchestrator: 'Coordina el traspaso de trabajo entre agentes y arma la traza de correlación de cada ciclo. No decide sobre montos ni riesgo: solo enruta y registra.',
  billing: 'Consolida fuentes, valida consistencia cíclica y acíclica, detecta excepciones y gestiona conformidad antes de emitir la factura.',
  collections: 'Diseña la estrategia de contacto según historial y riesgo, interpreta respuestas de clientes y concilia pagos contra el estado de cuenta.',
  revenue: 'Aplica pagos conciliados contra el saldo real y confirma el cierre de cada cuenta por cobrar.',
  bi: 'Observa el resultado agregado del ciclo, recalcula riesgo, detecta patrones de cartera y devuelve recomendaciones a Cobranzas.',
};

export default function AgentDetailPanel({
  agentId,
  status,
  events,
  onClose,
}: {
  agentId: AgentId | null;
  status: AgentStatus;
  events: AgentEvent[];
  onClose: () => void;
}) {
  if (!agentId) return null;
  const propios = events.filter((e) => e.source === agentId || e.target === agentId).slice(0, 12);

  return (
    <Drawer open={!!agentId} onClose={onClose} width={400} title={AGENT_LABEL[agentId]} subtitle={<span style={{ fontSize: 12.5, color: colors.textMuted }}>Estado actual: {status}</span>}>
      <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, marginBottom: 18 }}>{DESCRIPCION[agentId]}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, marginBottom: 8 }}>Actividad reciente</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {propios.map((e) => (
          <div key={e.id} style={{ borderBottom: `1px solid ${colors.borderLight}`, paddingBottom: 8 }}>
            <div style={{ fontSize: 12.5, color: colors.text }}>{e.title}</div>
            {e.detail && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{e.detail}</div>}
          </div>
        ))}
        {propios.length === 0 && <div style={{ fontSize: 12.5, color: colors.textFaint }}>Sin eventos recientes para este agente.</div>}
      </div>
    </Drawer>
  );
}
