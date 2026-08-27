import { motion } from 'motion/react';
import { colors } from '../../lib/styles';
import { money } from '../../lib/api';
import { prefersReducedMotion } from '../../lib/motionTokens';

type Resumen = { cartera_pendiente: number; cartera_vencida: number; ratio_cobrado_facturado: number; clientes_riesgo_alto: number; facturas_en_cartera: number };
type Movimiento = { estado: string; monto: number };
type Email = { procesado: boolean };

export default function ControlColumn({ resumen, movimientos, emails }: { resumen: Resumen | null; movimientos: Movimiento[]; emails: Email[] }) {
  const porConciliar = movimientos.filter((m) => m.estado !== 'CONCILIADO').length;
  const conciliados = movimientos.filter((m) => m.estado === 'CONCILIADO');
  const montoConciliado = conciliados.reduce((s, m) => s + Number(m.monto || 0), 0);
  const sinClasificar = emails.filter((e) => !e.procesado).length;
  const sugerencias = movimientos.filter((m) => m.estado === 'IDENTIFICADO').length;

  return (
    <Panel>
      <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong }}>Control operativo</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Estado en tiempo real de la cartera</div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Kpi label="Cartera pendiente" value={resumen ? money(resumen.cartera_pendiente) : '—'} valueColor={colors.textStrong} footer="Datos en vivo de la cartera" />
        <Kpi label="Pagos por conciliar" value={String(porConciliar)} valueColor={colors.textStrong} footer="Requieren atención" footerColor={colors.amberDark} badge="!" badgeColor={colors.amberDark} bg={colors.amberBg} />
        <Kpi label="Movimientos conciliados" value={String(conciliados.length)} valueColor={colors.textStrong} footer={money(montoConciliado)} footerColor={colors.greenDark} badge="✓" badgeColor={colors.greenDark} bg={colors.greenBg} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: `1px solid ${colors.border}`, padding: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Actividad del agente</div>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: colors.greenDark, background: colors.greenBg, borderRadius: 6, padding: '3px 8px' }}>En línea</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Timeline sinClasificar={sinClasificar} sugerencias={sugerencias} />
        </div>
      </div>
    </Panel>
  );
}

function Timeline({ sinClasificar, sugerencias }: { sinClasificar: number; sugerencias: number }) {
  const nodos = [
    { label: 'Clasifica correos', detail: sinClasificar > 0 ? `${sinClasificar} correos por clasificar` : 'Bandeja al día', done: true },
    { label: 'Detecta pagos', detail: 'Identificando confirmaciones', done: true },
    { label: 'Cruza movimientos', detail: 'Comparando con extractos bancarios', done: true },
    { label: 'Sugiere conciliación', detail: sugerencias > 0 ? `${sugerencias} listas para revisión` : 'Sin sugerencias pendientes', done: false },
  ];
  const reduced = prefersReducedMotion();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {nodos.map((n, i) => (
        <div key={n.label} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 10 }}>
            {n.done ? (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.blue, flexShrink: 0 }} />
            ) : (
              <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                {!reduced && (
                  <motion.div
                    animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: colors.blue }}
                  />
                )}
                <div style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: colors.blue }} />
              </div>
            )}
            {i < nodos.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 26, background: colors.border }} />}
          </div>
          <div style={{ paddingBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.textStrong, display: 'flex', alignItems: 'center', gap: 6 }}>
              {n.label}
              {n.done && <span style={{ color: colors.greenDark, fontSize: 11 }}>✓</span>}
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{n.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, valueColor, footer, footerColor, badge, badgeColor, bg }: {
  label: string; value: string; valueColor: string; footer: string; footerColor?: string; badge?: string; badgeColor?: string; bg?: string;
}) {
  return (
    <div style={{ background: bg || '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: valueColor, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: footerColor || colors.textFaint }}>{footer}</span>
        {badge && <span style={{ color: badgeColor, fontSize: 12, fontWeight: 700 }}>{badge}</span>}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      {children}
    </div>
  );
}
