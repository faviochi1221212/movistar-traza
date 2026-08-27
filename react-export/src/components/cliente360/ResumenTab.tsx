import { colors, monoFont } from '../../lib/styles';
import { money, fecha } from '../../lib/api';
import { casoDestacado, estadoLabel, facturasPendientes, type Detalle } from './cliente360Logic';

function estadoTag(estado: string) {
  const positivo = estado === 'EMITIDO' || estado === 'APROBADO' || estado === 'LISTO_EMISION';
  const negativo = estado === 'OBSERVADO' || estado === 'SIN_RESPUESTA';
  const color = positivo ? colors.greenDark : negativo ? colors.redDark : colors.amberDark;
  const bg = positivo ? colors.greenBg : negativo ? colors.redBg : colors.amberBg;
  return { color, bg };
}

export default function ResumenTab({ detalle, onVerTrazabilidad }: { detalle: Detalle; onVerTrazabilidad: () => void }) {
  const pendientes = facturasPendientes(detalle);
  const caso = casoDestacado(detalle);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border}`, fontSize: 13.5, fontWeight: 700, color: colors.textStrong }}>Facturas del período</div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={th('left')}>DOCUMENTO</th>
                <th style={th('right')}>TOTAL</th>
                <th style={th('left')}>ESTADO</th>
                <th style={th('left')}>VENCIMIENTO</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.slice(0, 8).map((f) => {
                const s = estadoTag(f.estado);
                return (
                  <tr key={f.id}>
                    <td style={{ ...td, ...monoFont, fontSize: 12.5, fontWeight: 600, color: colors.textStrong }}>{f.numero}</td>
                    <td style={{ ...td, fontSize: 12.5, fontWeight: 600, color: colors.textStrong, textAlign: 'right' }}>{money(f.monto)}</td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 5, padding: '3px 8px' }}>{estadoLabel(f.estado)}</span></td>
                    <td style={{ ...td, fontSize: 12, color: colors.textMuted }}>{fecha(f.fecha_vencimiento)}</td>
                  </tr>
                );
              })}
              {pendientes.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 18, textAlign: 'center', fontSize: 12.5, color: colors.textFaint }}>No hay facturas pendientes en este período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {caso && (
          <div style={{ margin: 16, marginTop: 'auto', background: colors.blueBg, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: colors.text, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: colors.blueDark, flexShrink: 0 }}>ⓘ</span>
            <span>Hay una comunicación de "{caso.comunicacion.clasificacion ? caso.comunicacion.clasificacion : 'seguimiento'}" identificada en Cobranza, pero la factura {caso.factura.numero} aún no se concilia en Facturación.</span>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textStrong, marginBottom: 16 }}>Análisis integral de la cuenta</div>

        <Bloque icono="📄" titulo="Facturación" texto={
          pendientes.length > 0
            ? `${pendientes.length} documento(s) siguen sin cerrar el ciclo; el más reciente es ${pendientes[0].numero} por ${money(pendientes[0].monto)}.`
            : 'Todas las facturas del cliente fueron emitidas correctamente.'
        } />
        <Bloque icono="💬" titulo="Cobranza" texto={
          detalle.comunicaciones.length > 0
            ? `Hay ${detalle.comunicaciones.length} comunicación(es) registrada(s). ${caso ? 'Conviene detener recordatorios hasta validar la más reciente.' : 'Sin reclamos activos por ahora.'}`
            : 'No hay comunicaciones registradas para este cliente.'
        } />
        <Bloque icono="📊" titulo="Insight BI" texto={
          detalle.dias_promedio_pago != null
            ? `Este cliente paga en promedio ${detalle.dias_promedio_pago} días después de la emisión. Riesgo estimado: ${detalle.resumen?.nivel_riesgo || 'sin evaluar'}.`
            : 'Aún no hay suficiente historial de pagos para estimar un patrón.'
        } last />

        <div onClick={onVerTrazabilidad} style={{ fontSize: 12, color: colors.blueDark, fontWeight: 600, cursor: 'pointer', marginTop: 'auto', paddingTop: 8 }}>Ver trazabilidad →</div>
      </div>
    </div>
  );
}

function Bloque({ icono, titulo, texto, last }: { icono: string; titulo: string; texto: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: last ? 'none' : `1px solid ${colors.borderLight}` }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icono}</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, marginBottom: 3 }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: colors.text, lineHeight: 1.5 }}>{texto}</div>
      </div>
    </div>
  );
}

const td: React.CSSProperties = { padding: '10px 14px', borderBottom: `1px solid ${colors.borderLight}` };
function th(align: 'left' | 'right'): React.CSSProperties {
  return { textAlign: align, fontSize: 10.5, fontWeight: 600, color: colors.textMuted, letterSpacing: 0.3, padding: '9px 14px', borderBottom: `1px solid ${colors.border}` };
}
