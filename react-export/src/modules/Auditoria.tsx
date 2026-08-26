import { useEffect, useState } from 'react';
import { colors, monoFont, tabStyle } from '../lib/styles';
import { api, fechaHora } from '../lib/api';
import Drawer from '../components/Drawer';

type Resumen = { eventos_registrados: number; acciones_ia_ejecutadas: number; revisiones_pendientes: number; alertas_criticas: number };
type Evento = { id: number; trace_id: string | null; actor_tipo: string; actor_id: string | null; accion: string; entidad_tipo: string | null; entidad_id: string | null; created_at: string };

const TABS = [
  { id: 'centro', label: 'Centro de auditoría' },
  { id: 'trazas', label: 'Trazabilidad de eventos' },
] as const;
type TabId = typeof TABS[number]['id'];

function tagBox(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, color, background: bg, borderRadius: 5, padding: '4px 9px' };
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export default function Auditoria() {
  const [tab, setTab] = useState<TabId>('centro');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [trazaId, setTrazaId] = useState<string | null>(null);
  const [traza, setTraza] = useState<any>(null);

  useEffect(() => {
    api.get<Resumen>('/api/auditoria/resumen').then(setResumen);
    api.get<Evento[]>('/api/auditoria?limit=200').then(setEventos);
  }, []);

  useEffect(() => {
    if (trazaId) api.get(`/api/auditoria/${trazaId}`).then(setTraza).catch(() => setTraza(null));
  }, [trazaId]);

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Auditoría</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Control y trazabilidad de las operaciones ejecutadas en TRAZA.</div>
        </div>
        <a href={`${API_BASE}/api/auditoria/export`} target="_blank" rel="noreferrer"><button style={btnLight}>Exportar</button></a>
      </div>

      <div style={{ display: 'flex', gap: 26, borderBottom: `1px solid ${colors.border}`, marginBottom: 24 }}>
        {TABS.map((t) => <div key={t.id} style={tabStyle(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</div>)}
      </div>

      {tab === 'centro' && resumen && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            <Kpi label="Eventos registrados" value={String(resumen.eventos_registrados)} />
            <Kpi label="Acciones IA ejecutadas" value={String(resumen.acciones_ia_ejecutadas)} />
            <Kpi label="Revisiones pendientes" value={String(resumen.revisiones_pendientes)} color={colors.amberDark} />
            <Kpi label="Alertas críticas" value={String(resumen.alertas_criticas)} color={colors.redDark} />
          </div>
          <EventosTabla eventos={eventos.slice(0, 20)} onVerTraza={setTrazaId} />
        </div>
      )}

      {tab === 'trazas' && <EventosTabla eventos={eventos} onVerTraza={setTrazaId} />}

      <Drawer open={!!trazaId} onClose={() => { setTrazaId(null); setTraza(null); }} width={480} title="Reconstrucción de traza"
        subtitle={traza && <div style={{ ...monoFont, fontSize: 12.5, color: colors.textMuted }}>{traza.traza.correlation_id}</div>}>
        {traza ? (
          <div>
            <Section title="TAREAS DE AGENTES">
              {traza.tareas.map((t: any, i: number) => (
                <div key={i} style={{ fontSize: 13, color: colors.text, marginBottom: 6 }}>
                  <b>{t.agente}</b> · {t.tipo_tarea} → <span style={tagBox(colors.blueDark, colors.blueBg)}>{t.estado}</span>
                </div>
              ))}
              {traza.tareas.length === 0 && <div style={{ fontSize: 13, color: colors.textFaint }}>Sin tareas asociadas.</div>}
            </Section>
            <Section title="LÍNEA DE TIEMPO">
              {traza.eventos.map((e: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: colors.textFaint, minWidth: 110 }}>{fechaHora(e.created_at)}</div>
                  <div style={{ fontSize: 12.5, color: colors.text }}>{e.accion}</div>
                </div>
              ))}
            </Section>
          </div>
        ) : <div style={{ fontSize: 13, color: colors.textMuted }}>Esta acción no pertenece a una traza de ciclo de ingreso.</div>}
      </Drawer>
    </div>
  );
}

function EventosTabla({ eventos, onVerTraza }: { eventos: Evento[]; onVerTraza: (id: string) => void }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Últimos eventos relevantes</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#F8FAFC' }}>
          <th style={th('left', 20)}>FECHA</th><th style={th('left')}>ACTOR</th><th style={th('left')}>ACCIÓN</th>
          <th style={th('left')}>ENTIDAD</th><th style={th('right', 20)}>ACCIÓN</th>
        </tr></thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e.id}>
              <td style={{ padding: '10px 20px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12, color: colors.textMuted }}>{fechaHora(e.created_at)}</td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.borderLight}` }}><span style={tagBox(e.actor_tipo === 'AGENT' ? colors.blueDark : '#475467', e.actor_tipo === 'AGENT' ? colors.blueBg : '#F1F4F8')}>{e.actor_tipo}</span></td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12.5, color: colors.text }}>{e.accion}</td>
              <td style={{ ...monoFont, padding: '10px 12px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12, color: colors.textMuted }}>{e.entidad_tipo || '—'}</td>
              <td style={{ padding: '10px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}>
                {e.trace_id && <button onClick={() => onVerTraza(e.trace_id!)} style={btnGhost}>Ver detalle</button>}
              </td>
            </tr>
          ))}
          {eventos.length === 0 && <tr><td colSpan={5} style={{ padding: 20, fontSize: 13, color: colors.textFaint }}>Sin eventos registrados aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 22 }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: colors.textMuted, marginBottom: 10 }}>{title}</div>{children}</div>;
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
const btnLight: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { height: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
