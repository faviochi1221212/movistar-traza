import { colors, monoFont } from '../../lib/styles';
import { money, fecha } from '../../lib/api';

type Email = { id: string; cliente_nombre: string | null; asunto: string; cuerpo: string; clasificacion: string | null; confianza: number | null; procesado: boolean; recibido_at: string; factura_id: string | null };
type CarteraRow = { factura_id: string; numero: string; saldo_pendiente: number };
type MatchInfo = { id: string; score: number; criterios: Record<string, any>; estado: string; tipo_match: string };
type Movimiento = { id: string; banco: string; nro_operacion: string; match?: MatchInfo | null };

const CLASIF_LABEL: Record<string, string> = {
  CONFIRMACION_PAGO: 'Confirmación de pago', PROMESA_PAGO: 'Promesa de pago', CONSULTA: 'Consulta',
  RECLAMO: 'Reclamo', NOTA_CREDITO: 'Nota de crédito', OTRO: 'Otro',
};

export default function DetailColumn({
  email, factura, movimiento, clasificando, conciliando, onClasificar, onConciliar, onRevisarManual,
}: {
  email: Email | null; factura: CarteraRow | undefined; movimiento: Movimiento | undefined;
  clasificando: boolean; conciliando: boolean;
  onClasificar: () => void; onConciliar: () => void; onRevisarManual: () => void;
}) {
  const match = movimiento?.match || null;
  const conciliado = match?.estado === 'ACEPTADO';
  const puedeConciliar = match?.estado === 'SUGERIDO';

  const motivoNoConciliar = conciliado || puedeConciliar
    ? null
    : !factura
      ? 'Este correo no tiene una factura relacionada.'
      : !movimiento || !match
        ? 'Aún no se detectó un movimiento bancario para esta factura.'
        : match.estado === 'RECHAZADO'
          ? 'La sugerencia de conciliación fue rechazada anteriormente.'
          : 'Sin sugerencia de conciliación disponible por ahora.';

  const estadoBadge = !email
    ? null
    : !email.clasificacion
      ? { label: 'Sin clasificar', fg: colors.textMuted, bg: '#F1F4F8' }
      : conciliado
        ? { label: 'Conciliado', fg: colors.greenDark, bg: colors.greenBg }
        : email.clasificacion === 'CONFIRMACION_PAGO'
          ? { label: 'Por conciliar', fg: colors.amberDark, bg: colors.amberBg }
          : { label: 'En gestión', fg: colors.blueDark, bg: colors.blueBg };

  return (
    <Panel>
      <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textStrong }}>Detalle de gestión</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Información extraída y conciliación sugerida</div>
        </div>
        {estadoBadge && <span style={{ fontSize: 10.5, fontWeight: 600, color: estadoBadge.fg, background: estadoBadge.bg, borderRadius: 6, padding: '4px 9px', flexShrink: 0 }}>{estadoBadge.label}</span>}
      </div>

      {!email ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, color: colors.textFaint }}>Selecciona una comunicación de la bandeja para ver el detalle.</span>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#F8FAFC', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: colors.blueBg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: colors.blueDark, flexShrink: 0 }}>
                {(email.cliente_nombre || '?').charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textStrong }}>{email.cliente_nombre || 'Cliente sin identificar'}</div>
                  <div style={{ fontSize: 11, color: colors.textFaint, whiteSpace: 'nowrap' }}>{fecha(email.recibido_at)}</div>
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 }}>{email.cuerpo.slice(0, 160)}{email.cuerpo.length > 160 ? '…' : ''}</div>
              </div>
            </div>
          </div>

          <Card title="Información extraída">
            <Row label="Tipo" value={email.clasificacion ? CLASIF_LABEL[email.clasificacion] || email.clasificacion : 'Pendiente de clasificar'} />
            <Row label="Factura relacionada" value={factura?.numero || 'No detectada'} accent={!!factura} />
            <Row label="Fecha" value={fecha(email.recibido_at)} />
            <Row label="Monto de la factura" value={factura ? money(factura.saldo_pendiente) : '—'} accent={!!factura} />
            <Row label="Banco / operación" value={movimiento ? `${movimiento.banco} · Op. ${movimiento.nro_operacion}` : 'Sin movimiento asociado'} />
            <Row label="Estado" value={estadoBadge?.label || '—'} valueColor={estadoBadge?.fg} last />
          </Card>

          <Card title="Análisis IA">
            {match ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {Object.entries(match.criterios || {}).filter(([k]) => k !== 'candidatos_alternativos').map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12, color: colors.text, display: 'flex', gap: 8 }}>
                      <span style={{ color: v ? colors.greenDark : colors.textFaint }}>{v ? '✓' : '—'}</span>
                      {String(k).replace(/_/g, ' ')}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: colors.text, display: 'flex', gap: 8 }}>
                    <span style={{ color: colors.greenDark }}>✓</span> Probabilidad de match: {(match.score * 100).toFixed(0)}%
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: '#F1F4F8', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, match.score * 100)}%`, background: colors.blue, borderRadius: 4 }} />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: colors.textFaint }}>Aún no se evaluó ningún movimiento bancario contra esta factura.</div>
            )}
          </Card>
        </div>
      )}

      {email && (
        <div style={{ padding: 16, borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ActionButton primary disabled={!puedeConciliar || conciliando} onClick={onConciliar}>
            {conciliando ? 'Conciliando…' : conciliado ? 'Ya conciliado ✓' : 'Conciliar pago'}
          </ActionButton>
          {motivoNoConciliar && <div style={{ fontSize: 11, color: colors.textFaint, marginTop: -2, textAlign: 'center' }}>{motivoNoConciliar}</div>}
          <ActionButton disabled={!!email.clasificacion || clasificando} onClick={onClasificar} variant="info">
            {clasificando ? 'Clasificando…' : email.clasificacion ? 'Ya clasificado' : 'Solicitar validación'}
          </ActionButton>
          <ActionButton onClick={onRevisarManual} variant="neutral">Revisar manualmente</ActionButton>
        </div>
      )}
    </Panel>
  );
}

function Row({ label, value, accent, valueColor, last }: { label: string; value: string; accent?: boolean; valueColor?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 38, borderBottom: last ? 'none' : `1px solid ${colors.borderLight}` }}>
      <span style={{ fontSize: 12, color: colors.textMuted }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: valueColor || (accent ? colors.blueDark : colors.textStrong), ...(accent ? monoFont : {}) }}>{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function ActionButton({ children, onClick, disabled, primary, variant }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; variant?: 'info' | 'neutral' }) {
  const base: React.CSSProperties = { height: 40, borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', border: `1px solid ${colors.border}`, opacity: disabled ? 0.45 : 1 };
  const style: React.CSSProperties = primary
    ? { ...base, background: colors.navy, border: 'none', color: '#fff' }
    : variant === 'info'
      ? { ...base, background: colors.blueBg, borderColor: colors.blue, color: colors.blueDark }
      : { ...base, background: '#fff', color: colors.text };
  return <button onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      {children}
    </div>
  );
}
