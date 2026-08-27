import { colors } from '../../lib/styles';
import { money } from '../../lib/api';
import { facturasPendientes, type Detalle } from './cliente360Logic';

export default function KpiRow({ detalle }: { detalle: Detalle }) {
  const r = detalle.resumen;
  const pendientes = facturasPendientes(detalle);
  const riesgo = r?.nivel_riesgo || 'Sin evaluar';
  const riesgoColor = riesgo === 'ALTO' ? colors.redDark : riesgo === 'MEDIO' ? colors.amberDark : riesgo === 'BAJO' ? colors.greenDark : colors.textMuted;
  const riesgoPct = riesgo === 'ALTO' ? 90 : riesgo === 'MEDIO' ? 55 : riesgo === 'BAJO' ? 20 : 0;

  const saldoPct = r && r.total_facturado > 0 ? Math.min(100, (r.saldo_pendiente / r.total_facturado) * 100) : 0;
  const pendientesPct = r && r.total_facturas > 0 ? Math.min(100, (pendientes.length / r.total_facturas) * 100) : 0;
  const diasPct = detalle.dias_promedio_pago != null ? Math.min(100, (detalle.dias_promedio_pago / 60) * 100) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
      <Kpi titulo="Saldo pendiente" valor={money(r?.saldo_pendiente ?? 0)} sub="Saldo por conciliar" pct={saldoPct} color={colors.blue} />
      <Kpi titulo="Facturas pendientes" valor={`${pendientes.length} documento${pendientes.length === 1 ? '' : 's'}`} sub="Documentos pendientes de pago" pct={pendientesPct} color={colors.blue} />
      <Kpi titulo="Días promedio de pago" valor={detalle.dias_promedio_pago != null ? `${detalle.dias_promedio_pago} días` : '—'} sub="Promedio histórico de pagos" pct={diasPct} color={colors.blue} />
      <Kpi titulo="Riesgo de cobranza" valor={riesgo === 'Sin evaluar' ? riesgo : riesgo.charAt(0) + riesgo.slice(1).toLowerCase()} sub="Nivel de riesgo estimado por el modelo" pct={riesgoPct} color={riesgoColor} />
    </div>
  );
}

function Kpi({ titulo, valor, sub, pct, color }: { titulo: string; valor: string; sub: string; pct: number; color: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 600 }}>{titulo}</div>
        <span style={{ fontSize: 12, color: colors.textFaint }}>ⓘ</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, marginTop: 6 }}>{valor}</div>
      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>{sub}</div>
      <div style={{ height: 4, borderRadius: 3, background: '#F1F4F8', marginTop: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
