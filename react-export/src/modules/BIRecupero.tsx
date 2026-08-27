import { useEffect, useMemo, useState } from 'react';
import { colors } from '../lib/styles';
import { api, money } from '../lib/api';
import BarMetricChart from '../components/bi/BarMetricChart';
import LineMetricChart from '../components/bi/LineMetricChart';
import BIInsights from '../components/bi/BIInsights';
import BICopilot from '../components/bi/BICopilot';
import type { ChartSpec } from '../components/bi/charts';

type ResumenGeneral = {
  facturacion: { monto_facturado: number };
  cobranzas: { cartera_pendiente: number; cartera_vencida: number };
  recaudo: { conciliaciones_automaticas: number; conciliaciones_manuales: number; movimientos_pendientes: number; monto_pagado_aplicado: number };
};
type ResumenCartera = { cartera_pendiente: number; cartera_vencida: number; ratio_cobrado_facturado: number; clientes_riesgo_alto: number; facturas_en_cartera: number };
type CarteraRow = { factura_id: string; numero: string; cliente_id: string; razon_social: string; saldo_pendiente: number; fecha_vencimiento: string; dias_vencidos: number; aging: string };
type RiesgoCliente = { cliente_id: string; razon_social: string; probabilidad_pago: number; nivel_riesgo: string; saldo_pendiente: number; dias_vencidos: number };
type Oportunidad = { cliente_id: string; razon_social: string; saldo_pendiente: number; dias_vencidos: number; facturas_vencidas: number; probabilidad_pago: number; nivel_riesgo: string; prioridad: string; oportunidad: string; accion_sugerida: string };
type TendenciaMes = { mes: string; monto_facturado: number; monto_cobrado: number; ratio_cobrado_facturado: number };
type Tendencia = { meses: TendenciaMes[]; periodo_medio_cobro_dias: number | null };

const AGING_ORDER = ['POR_VENCER', '0_30', '31_60', '61_90', 'MAS_90'];
const AGING_LABEL: Record<string, string> = { POR_VENCER: 'Por vencer', '0_30': '0-30 días', '31_60': '31-60 días', '61_90': '61-90 días', MAS_90: '+90 días' };

function mesLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
}

export default function BIRecupero() {
  const [resumen, setResumen] = useState<ResumenGeneral | null>(null);
  const [resumenCartera, setResumenCartera] = useState<ResumenCartera | null>(null);
  const [cartera, setCartera] = useState<CarteraRow[]>([]);
  const [riesgo, setRiesgo] = useState<{ resumen: { distribucion: Record<string, number>; total_evaluados: number }; top_clientes: RiesgoCliente[] } | null>(null);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [tendencia, setTendencia] = useState<Tendencia | null>(null);
  const [actualizadoHace, setActualizadoHace] = useState(0);

  const [barOverride, setBarOverride] = useState<ChartSpec | null>(null);
  const [lineOverride, setLineOverride] = useState<ChartSpec | null>(null);

  useEffect(() => {
    const t0 = Date.now();
    Promise.all([
      api.get<ResumenGeneral>('/api/bi/resumen').then(setResumen).catch(() => {}),
      api.get<ResumenCartera>('/api/cobranzas/resumen').then(setResumenCartera).catch(() => {}),
      api.get<CarteraRow[]>('/api/cobranzas/cartera?limit=500&aging=TODOS').then(setCartera).catch(() => {}),
      api.get('/api/bi/riesgo?limit=1200').then(setRiesgo as any).catch(() => {}),
      api.get<Oportunidad[]>('/api/bi/recupero?limit=200').then(setOportunidades).catch(() => {}),
      api.get<Tendencia>('/api/bi/tendencia').then(setTendencia).catch(() => {}),
    ]).finally(() => setActualizadoHace(Math.round((Date.now() - t0) / 1000)));
  }, []);

  const porAging = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of cartera) acc[c.aging] = (acc[c.aging] || 0) + Number(c.saldo_pendiente);
    return acc;
  }, [cartera]);

  const barDefault: ChartSpec = useMemo(() => ({
    type: 'bar', title: 'Cartera por antigüedad', subtitle: 'Monto pendiente por rango de vencimiento', format: 'money',
    data: AGING_ORDER.map((k) => ({ label: AGING_LABEL[k], value: porAging[k] || 0 })),
  }), [porAging]);

  const lineDefault: ChartSpec = useMemo(() => ({
    type: 'line', title: 'Evolución cobrado / facturado', subtitle: 'Últimos 6 meses', format: 'percent',
    data: (tendencia?.meses || []).map((m) => ({ label: mesLabel(m.mes), value: m.ratio_cobrado_facturado })),
  }), [tendencia]);

  const insights = useMemo(() => {
    const out: string[] = [];
    const totalPendiente = cartera.reduce((s, c) => s + Number(c.saldo_pendiente), 0);
    const masNoventa = porAging.MAS_90 || 0;
    if (totalPendiente > 0 && masNoventa > 0) {
      out.push(`La cartera +90 días concentra el ${((masNoventa / totalPendiente) * 100).toFixed(0)}% del saldo pendiente.`);
    }
    const meses = tendencia?.meses || [];
    if (meses.length >= 2) {
      const delta = (meses[meses.length - 1].ratio_cobrado_facturado - meses[0].ratio_cobrado_facturado) * 100;
      out.push(`El ratio cobrado/facturado ${delta >= 0 ? 'mejoró' : 'cayó'} ${Math.abs(delta).toFixed(1)} pp en los últimos ${meses.length} meses.`);
    }
    const altos = (riesgo?.top_clientes || []).filter((r) => r.nivel_riesgo === 'ALTO');
    if (altos.length > 0 && totalPendiente > 0) {
      const montoAlto = altos.reduce((s, r) => s + Number(r.saldo_pendiente), 0);
      out.push(`${altos.length} clientes evaluados en riesgo alto concentran el ${((montoAlto / totalPendiente) * 100).toFixed(0)}% de la cartera pendiente.`);
    }
    return out;
  }, [cartera, porAging, tendencia, riesgo]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>BI &amp; Recupero</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Inteligencia operativa sobre facturación, cobranza, recaudo y comportamiento de pago.</div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(300px, 1fr)', gap: 14, alignItems: 'stretch',
        height: 'calc(100vh - 210px)', minHeight: 560,
      }}>
        <div style={{ minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: colors.textFaint }}>{actualizadoHace > 0 ? `Actualizado hace ${actualizadoHace}s` : 'Actualizando…'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            <Kpi label="Cartera pendiente" value={resumen ? money(resumen.cobranzas.cartera_pendiente) : '—'} />
            <Kpi label="Cobrado / facturado" value={resumenCartera ? `${(resumenCartera.ratio_cobrado_facturado * 100).toFixed(1)}%` : '—'} color={colors.greenDark} />
            <Kpi label="Periodo medio de cobro" value={tendencia?.periodo_medio_cobro_dias != null ? `${tendencia.periodo_medio_cobro_dias} días` : '—'} />
            <Kpi label="Clientes en riesgo alto" value={riesgo ? String(riesgo.resumen.distribucion.ALTO || 0) : '—'} color={colors.amberDark} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, minHeight: 240 }}>
            <BarMetricChart spec={barOverride || barDefault} onReset={barOverride ? () => setBarOverride(null) : undefined} />
            <LineMetricChart spec={lineOverride || lineDefault} onReset={lineOverride ? () => setLineOverride(null) : undefined} />
          </div>

          <BIInsights insights={insights} />
        </div>

        <BICopilot
          cartera={cartera} riesgo={riesgo?.top_clientes || []} oportunidades={oportunidades} tendencia={tendencia?.meses || []}
          onAplicarBar={setBarOverride} onAplicarLine={setLineOverride}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || colors.textStrong, marginTop: 6 }}>{value}</div>
    </div>
  );
}
