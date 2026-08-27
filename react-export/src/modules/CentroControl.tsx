import { useEffect, useRef, useState } from 'react';
import { colors, monoFont, priorityStyle } from '../lib/styles';
import { api, fechaHora, money } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import OrchestrationMap, { type FlightPacket } from '../components/orchestration/OrchestrationMap';
import LiveActivityFeed from '../components/agents/LiveActivityFeed';
import AgentDetailPanel from '../components/agents/AgentDetailPanel';
import { CICLO_FACTURACION_PAGO, buildEvents, DEMO_CLIENTE, DEMO_FACTURA, DEMO_MONTO } from '../data/demoScenario';
import type { AgentEvent, AgentId, AgentStatus } from '../types/agents';

type Resumen = {
  estado_general: {
    facturacion: { validacion: { correctas: number; en_revision: number }; control: { casos_abiertos: number; casos_criticos: number } };
    cartera_pendiente: number; cartera_vencida: number;
    conciliaciones_automaticas: number; conciliaciones_manuales: number;
  };
  casos_relevantes: { modulo: string; prioridad: string; cliente: string | null; asunto: string; impacto: number | null; id: string }[];
  actividad_reciente: { accion: string; actor_tipo: string; entidad_tipo: string | null; created_at: string }[];
};

function tagBox(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, color, background: bg, borderRadius: 5, padding: '4px 9px' };
}

const RUTA_MODULO: Record<string, string> = { 'Facturación': '/facturacion', 'Cobranzas': '/cobranzas', 'Recaudo': '/cobranzas' };

const AGENT_IDS: AgentId[] = ['orchestrator', 'billing', 'collections', 'revenue', 'bi'];
const IDLE_STATUSES: Record<AgentId, AgentStatus> = { orchestrator: 'idle', billing: 'idle', collections: 'idle', revenue: 'idle', bi: 'idle' };

function restingStatus(sev: AgentEvent['severity']): AgentStatus {
  if (sev === 'critical' || sev === 'warning') return 'attention';
  if (sev === 'success') return 'completed';
  return 'idle';
}

export default function CentroControl() {
  const [data, setData] = useState<Resumen | null>(null);
  const navigate = useNavigate();

  const [statuses, setStatuses] = useState<Record<AgentId, AgentStatus>>(IDLE_STATUSES);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [packets, setPackets] = useState<FlightPacket[]>([]);
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [detailAgent, setDetailAgent] = useState<AgentId | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => { api.get<Resumen>('/api/centro-control/resumen').then(setData).catch(() => setData(null)); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const schedule = (fn: () => void, delay: number) => { timers.current.push(window.setTimeout(fn, delay)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const handlePacketArrive = (id: string) => {
    setPackets((prev) => {
      const pk = prev.find((x) => x.id === id);
      if (pk) {
        setActiveEdges((edges) => { const n = new Set(edges); n.delete(`${pk.from}-${pk.to}`); return n; });
        setStatuses((s) => ({ ...s, [pk.from]: 'idle', [pk.to]: 'processing' }));
        schedule(() => setStatuses((s) => ({ ...s, [pk.to]: 'idle' })), 700);
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  const stopScenario = () => { clearTimers(); setPlaying(false); setPackets([]); setActiveEdges(new Set()); };

  const playScenario = () => {
    if (playing) { stopScenario(); return; }
    clearTimers();
    setEvents([]);
    setPackets([]);
    setActiveEdges(new Set());
    setStatuses(IDLE_STATUSES);
    setPlaying(true);

    const built = buildEvents(CICLO_FACTURACION_PAGO);
    let offset = 0;
    CICLO_FACTURACION_PAGO.forEach((step, i) => {
      offset += step.delayMs;
      const evt = built[i];
      schedule(() => {
        setEvents((prev) => [evt, ...prev].slice(0, 40));
        setStatuses((s) => ({ ...s, [step.source]: 'processing' }));
        if (step.target) {
          setActiveEdges((s) => new Set(s).add(`${step.source}-${step.target}`));
          setPackets((p) => [...p, { id: evt.id, from: step.source, to: step.target!, severity: step.severity }]);
        } else {
          schedule(() => setStatuses((s) => ({ ...s, [step.source]: restingStatus(step.severity) })), 850);
        }
      }, offset);
    });
    schedule(() => setPlaying(false), offset + 900);
  };

  const g = data?.estado_general;

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Centro de Control</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Mirada transversal del ciclo de ingreso completo.</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong }}>Mapa vivo del ciclo de ingreso</div>
            <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 3 }}>
              Cómo se comunican los agentes en tiempo real · caso de referencia {DEMO_CLIENTE} / {DEMO_FACTURA} ({DEMO_MONTO})
            </div>
          </div>
          <button
            onClick={playScenario}
            style={{
              height: 38, padding: '0 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: playing ? colors.redDark : colors.navy, color: '#fff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            {playing ? '■ Detener' : '▶ Procesar ciclo'}
          </button>
        </div>

        <style>{`
          @media (max-width: 980px) {
            .tc-mapa-grid { grid-template-columns: 1fr !important; }
            .tc-mapa-grid > div:first-child { border-right: none !important; border-bottom: 1px solid ${colors.border}; }
            .tc-kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
            .tc-casos-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <div className="tc-mapa-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 0 }}>
          <div style={{ padding: '10px 8px', borderRight: `1px solid ${colors.border}` }}>
            <OrchestrationMap
              statuses={statuses}
              activeEdges={activeEdges}
              packets={packets}
              onNodeClick={setDetailAgent}
              onPacketArrive={handlePacketArrive}
            />
          </div>
          <div style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, marginBottom: 6 }}>Actividad en vivo</div>
            <LiveActivityFeed events={events} />
          </div>
        </div>
      </div>

      {!g && (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18, marginBottom: 20, fontSize: 13, color: colors.textMuted }}>
          Cargando estado general del ciclo de ingreso… (si esto persiste, el backend o la base de datos no están disponibles; el mapa de agentes de arriba funciona igual)
        </div>
      )}

      {g && (
        <>
          <div className="tc-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            <Kpi label="Validaciones correctas" value={String(g.facturacion.validacion.correctas)} />
            <Kpi label="Casos críticos abiertos" value={String(g.facturacion.control.casos_criticos)} color={colors.redDark} />
            <Kpi label="Cartera vencida" value={money(g.cartera_vencida)} color={colors.redDark} />
            <Kpi label="Conciliaciones automáticas" value={String(g.conciliaciones_automaticas)} color={colors.greenDark} />
          </div>

          <div className="tc-casos-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Casos relevantes</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F8FAFC' }}>
                  <th style={th('left', 20)}>MÓDULO</th><th style={th('left')}>PRIORIDAD</th><th style={th('left')}>CLIENTE</th>
                  <th style={th('left')}>ASUNTO</th><th style={th('right', 20)}>ACCIÓN</th>
                </tr></thead>
                <tbody>
                  {data!.casos_relevantes.map((c, i) => (
                    <tr key={i}>
                      <td style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12.5, color: colors.textMuted }}>{c.modulo}</td>
                      <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={priorityStyle(c.prioridad === 'ALTA' || c.prioridad === 'CRITICA' ? 'Alta' : c.prioridad === 'MEDIA' ? 'Media' : 'Baja')}>{c.prioridad}</span></td>
                      <td style={{ ...monoFont, padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{c.cliente || '—'}</td>
                      <td style={{ padding: '12px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 13, color: colors.text }}>{c.asunto}</td>
                      <td style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}>
                        <button onClick={() => navigate(RUTA_MODULO[c.modulo] || '/facturacion')} style={btnGhost}>Revisar caso</button>
                      </td>
                    </tr>
                  ))}
                  {data!.casos_relevantes.length === 0 && <tr><td colSpan={5} style={{ padding: 20, fontSize: 13, color: colors.textFaint }}>No hay casos relevantes pendientes.</td></tr>}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Actividad reciente</div>
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 420, overflowY: 'auto' }}>
                {data!.actividad_reciente.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={tagBox(a.actor_tipo === 'AGENT' ? colors.blueDark : '#475467', a.actor_tipo === 'AGENT' ? colors.blueBg : '#F1F4F8')}>{a.actor_tipo}</span>
                    <div>
                      <div style={{ fontSize: 12.5, color: colors.text }}>{a.accion}</div>
                      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>{fechaHora(a.created_at)}</div>
                    </div>
                  </div>
                ))}
                {data!.actividad_reciente.length === 0 && <div style={{ fontSize: 13, color: colors.textFaint }}>Sin actividad registrada.</div>}
              </div>
            </div>
          </div>
        </>
      )}

      <AgentDetailPanel agentId={detailAgent} status={detailAgent ? statuses[detailAgent] : 'idle'} events={events} onClose={() => setDetailAgent(null)} />
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || colors.textStrong, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function th(align: 'left' | 'right', pad = 12): React.CSSProperties {
  return { textAlign: align, fontSize: 11, fontWeight: 600, color: colors.textMuted, padding: `10px ${pad}px`, borderBottom: `1px solid ${colors.border}` };
}
const btnGhost: React.CSSProperties = { height: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
