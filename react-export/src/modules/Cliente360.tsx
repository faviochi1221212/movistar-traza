import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../lib/styles';
import { api, money } from '../lib/api';
import ClienteHeader from '../components/cliente360/ClienteHeader';
import KpiRow from '../components/cliente360/KpiRow';
import SituacionYAccion from '../components/cliente360/SituacionYAccion';
import ResumenTab from '../components/cliente360/ResumenTab';
import { FacturacionTab, CobranzaTab, BiTab } from '../components/cliente360/OtrosTabs';
import ActividadReciente from '../components/cliente360/ActividadReciente';
import Cliente360Asistente from '../components/cliente360/Cliente360Asistente';
import type { Detalle } from '../components/cliente360/cliente360Logic';

type Busqueda = { id: string; razon_social: string; ruc: string };
type TabId = 'resumen' | 'facturacion' | 'cobranza' | 'bi';
const TABS: { id: TabId; label: string; icono: string }[] = [
  { id: 'resumen', label: 'Resumen', icono: '◫' },
  { id: 'facturacion', label: 'Facturación', icono: '📄' },
  { id: 'cobranza', label: 'Cobranza', icono: '💬' },
  { id: 'bi', label: 'BI', icono: '📊' },
];

export default function Cliente360() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Busqueda[]>([]);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [tab, setTab] = useState<TabId>('resumen');
  const [aviso, setAviso] = useState<string | null>(null);

  const buscar = () => {
    if (!q.trim()) return;
    api.get<Busqueda[]>(`/api/cliente360/buscar?q=${encodeURIComponent(q)}`).then((r) => {
      setResultados(r);
      if (r.length === 1) verDetalle(r[0].id);
    });
  };

  const verDetalle = (id: string) => {
    api.get<Detalle>(`/api/cliente360/${id}`).then((d) => { setDetalle(d); setTab('resumen'); });
    setResultados([]);
  };

  const refrescar = () => { if (detalle) api.get<Detalle>(`/api/cliente360/${detalle.cliente.id}`).then(setDetalle); };

  const mostrarAviso = (texto: string) => { setAviso(texto); setTimeout(() => setAviso(null), 3000); };

  const exportarCsv = () => {
    if (!detalle) return;
    const header = 'Documento,Tipo,Monto,Estado,Emision,Vencimiento\n';
    const rows = detalle.facturas.map((f) => `${f.numero},${f.tipo_factura},${f.monto},${f.estado},${f.fecha_emision},${f.fecha_vencimiento}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `facturas_${detalle.cliente.razon_social}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>👥</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Cliente 360</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>Vista consolidada de facturación, cobranza, riesgo y trazabilidad por cliente.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, maxWidth: 480 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar por nombre o RUC..." style={{ flex: 1, height: 38, border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        <button onClick={buscar} style={{ height: 38, padding: '0 18px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Buscar</button>
      </div>

      {resultados.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 20, overflow: 'hidden', maxWidth: 480 }}>
          {resultados.map((r) => (
            <div key={r.id} onClick={() => verDetalle(r.id)} style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.borderLight}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: colors.textStrong }}>{r.razon_social}</span>
              <span style={{ fontSize: 12.5, color: colors.textMuted }}>{r.ruc}</span>
            </div>
          ))}
        </div>
      )}

      {detalle && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <ClienteHeader
              detalle={detalle}
              onVerTrazabilidad={() => navigate('/auditoria')}
              onExportar={exportarCsv}
              onAbrirCuenta={() => mostrarAviso('Vista de cuenta aún no disponible en este prototipo.')}
            />
            <KpiRow detalle={detalle} />
            <SituacionYAccion detalle={detalle} onIrAConciliacion={() => navigate('/facturacion')} />

            <div style={{ display: 'flex', gap: 22, borderBottom: `1px solid ${colors.border}`, marginBottom: 18 }}>
              {TABS.map((t) => (
                <div key={t.id} onClick={() => setTab(t.id)} style={{
                  height: 38, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  color: tab === t.id ? colors.textStrong : colors.textMuted,
                  borderBottom: tab === t.id ? `2px solid ${colors.blue}` : '2px solid transparent',
                }}>
                  <span style={{ fontSize: 12 }}>{t.icono}</span>{t.label}
                </div>
              ))}
            </div>

            {tab === 'resumen' && <ResumenTab detalle={detalle} onVerTrazabilidad={() => navigate('/auditoria')} />}
            {tab === 'facturacion' && <FacturacionTab detalle={detalle} />}
            {tab === 'cobranza' && <CobranzaTab detalle={detalle} />}
            {tab === 'bi' && <BiTab detalle={detalle} />}

            <div style={{ marginTop: 18 }}>
              <ActividadReciente detalle={detalle} onVerHistorial={() => navigate('/auditoria')} />
            </div>
          </div>

          <div style={{ height: 'calc(100vh - 260px)', minHeight: 640 }}>
            <Cliente360Asistente detalle={detalle} onRefrescar={refrescar} />
          </div>
        </div>
      )}

      {aviso && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: colors.navy, color: '#fff', borderRadius: 8, padding: '12px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 50 }}>
          {aviso}
        </div>
      )}
    </div>
  );
}
