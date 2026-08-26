import { useState } from 'react';
import { colors, monoFont } from '../lib/styles';
import { api, fecha, money } from '../lib/api';

type Busqueda = { id: string; razon_social: string; ruc: string };

function tagBox(color: string, bg: string): React.CSSProperties {
  return { display: 'inline-block', fontSize: 11.5, fontWeight: 600, color, background: bg, borderRadius: 5, padding: '4px 9px' };
}
function riesgoStyle(r: string | null) {
  if (r === 'ALTO') return tagBox(colors.redDark, colors.redBg);
  if (r === 'MEDIO') return tagBox(colors.amberDark, colors.amberBg);
  if (r === 'BAJO') return tagBox(colors.greenDark, colors.greenBg);
  return tagBox('#475467', '#F1F4F8');
}

export default function Cliente360() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Busqueda[]>([]);
  const [detalle, setDetalle] = useState<any>(null);

  const buscar = () => {
    if (!q.trim()) return;
    api.get<Busqueda[]>(`/api/cliente360/buscar?q=${encodeURIComponent(q)}`).then((r) => {
      setResultados(r);
      if (r.length === 1) verDetalle(r[0].id);
    });
  };

  const verDetalle = (id: string) => {
    api.get(`/api/cliente360/${id}`).then(setDetalle);
    setResultados([]);
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Cliente 360</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Vista consolidada de facturación, cartera, riesgo y trazabilidad por cliente.</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, maxWidth: 480 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar por nombre o RUC..." style={{ flex: 1, height: 38, border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        <button onClick={buscar} style={btnDark}>Buscar</button>
      </div>

      {resultados.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
          {resultados.map((r) => (
            <div key={r.id} onClick={() => verDetalle(r.id)} style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.borderLight}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: colors.textStrong }}>{r.razon_social}</span>
              <span style={{ ...monoFont, fontSize: 12.5, color: colors.textMuted }}>{r.ruc}</span>
            </div>
          ))}
        </div>
      )}

      {detalle && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: colors.textStrong }}>{detalle.cliente.razon_social}</div>
              <div style={{ ...monoFont, fontSize: 13, color: colors.textMuted, marginTop: 4 }}>RUC {detalle.cliente.numero_identificacion_fiscal}</div>
            </div>
            {detalle.resumen?.nivel_riesgo
              ? <span style={riesgoStyle(detalle.resumen.nivel_riesgo)}>Riesgo {detalle.resumen.nivel_riesgo}</span>
              : (detalle.resumen?.total_facturas ?? 0) === 0
                ? <span style={tagBox('#64748B', '#F1F4F8')}>Sin historial</span>
                : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            <Kpi label="Total facturas" value={String(detalle.resumen?.total_facturas ?? 0)} />
            <Kpi label="Total facturado" value={money(detalle.resumen?.total_facturado ?? 0)} />
            <Kpi label="Saldo pendiente" value={money(detalle.resumen?.saldo_pendiente ?? 0)} color={colors.redDark} />
            <Kpi label="Probabilidad de pago" value={detalle.resumen?.probabilidad_pago != null ? `${(detalle.resumen.probabilidad_pago * 100).toFixed(1)}%` : (detalle.resumen?.total_facturas ?? 0) === 0 ? 'Sin historial' : '—'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border}`, fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Facturas recientes</div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {detalle.facturas.map((f: any) => (
                  <div key={f.id} style={{ padding: '10px 18px', borderBottom: `1px solid ${colors.borderLight}`, display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={monoFont}>{f.numero}</span>
                    <span style={{ color: colors.textMuted }}>{fecha(f.fecha_emision)}</span>
                    <span style={{ fontWeight: 600, color: colors.textStrong }}>{money(f.monto)}</span>
                  </div>
                ))}
                {detalle.facturas.length === 0 && <div style={{ padding: 16, fontSize: 13, color: colors.textFaint }}>Sin facturas registradas.</div>}
              </div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border}`, fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Comunicaciones</div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {detalle.comunicaciones.map((c: any) => (
                  <div key={c.id} style={{ padding: '10px 18px', borderBottom: `1px solid ${colors.borderLight}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.textStrong }}>{c.asunto}</div>
                    <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 2 }}>{c.clasificacion || 'Sin clasificar'}</div>
                  </div>
                ))}
                {detalle.comunicaciones.length === 0 && <div style={{ padding: 16, fontSize: 13, color: colors.textFaint }}>Sin comunicaciones registradas.</div>}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CasosBox titulo="Casos de facturación" casos={detalle.casos_facturacion} />
            <CasosBox titulo="Casos de cobranza" casos={detalle.casos_cobranza} />
          </div>
        </div>
      )}
    </div>
  );
}

function CasosBox({ titulo, casos }: { titulo: string; casos: any[] }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border}`, fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>{titulo} ({casos.length})</div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {casos.map((c) => (
          <div key={c.id} style={{ padding: '10px 18px', borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12.5, color: colors.text }}>{c.asunto || c.descripcion}</div>
        ))}
        {casos.length === 0 && <div style={{ padding: 16, fontSize: 13, color: colors.textFaint }}>Sin casos abiertos.</div>}
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || colors.textStrong, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const btnDark: React.CSSProperties = { height: 38, padding: '0 18px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
