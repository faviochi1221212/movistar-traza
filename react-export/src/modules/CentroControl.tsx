import { useEffect, useState } from 'react';
import { colors, monoFont, priorityStyle } from '../lib/styles';
import { api, fechaHora, money } from '../lib/api';
import { useNavigate } from 'react-router-dom';

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

export default function CentroControl() {
  const [data, setData] = useState<Resumen | null>(null);
  const navigate = useNavigate();

  useEffect(() => { api.get<Resumen>('/api/centro-control/resumen').then(setData).catch(() => setData(null)); }, []);

  if (!data) return <div style={{ fontSize: 13, color: colors.textMuted }}>Cargando estado general…</div>;

  const g = data.estado_general;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Centro de Control</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Mirada transversal del ciclo de ingreso completo.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <Kpi label="Validaciones correctas" value={String(g.facturacion.validacion.correctas)} />
        <Kpi label="Casos críticos abiertos" value={String(g.facturacion.control.casos_criticos)} color={colors.redDark} />
        <Kpi label="Cartera vencida" value={money(g.cartera_vencida)} color={colors.redDark} />
        <Kpi label="Conciliaciones automáticas" value={String(g.conciliaciones_automaticas)} color={colors.greenDark} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Casos relevantes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F8FAFC' }}>
              <th style={th('left', 20)}>MÓDULO</th><th style={th('left')}>PRIORIDAD</th><th style={th('left')}>CLIENTE</th>
              <th style={th('left')}>ASUNTO</th><th style={th('right', 20)}>ACCIÓN</th>
            </tr></thead>
            <tbody>
              {data.casos_relevantes.map((c, i) => (
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
              {data.casos_relevantes.length === 0 && <tr><td colSpan={5} style={{ padding: 20, fontSize: 13, color: colors.textFaint }}>No hay casos relevantes pendientes.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14.5, fontWeight: 600, color: colors.textStrong }}>Actividad reciente</div>
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 420, overflowY: 'auto' }}>
            {data.actividad_reciente.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={tagBox(a.actor_tipo === 'AGENT' ? colors.blueDark : '#475467', a.actor_tipo === 'AGENT' ? colors.blueBg : '#F1F4F8')}>{a.actor_tipo}</span>
                <div>
                  <div style={{ fontSize: 12.5, color: colors.text }}>{a.accion}</div>
                  <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>{fechaHora(a.created_at)}</div>
                </div>
              </div>
            ))}
            {data.actividad_reciente.length === 0 && <div style={{ fontSize: 13, color: colors.textFaint }}>Sin actividad registrada.</div>}
          </div>
        </div>
      </div>
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
