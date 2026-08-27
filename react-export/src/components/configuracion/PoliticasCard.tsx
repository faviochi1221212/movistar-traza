import { colors } from '../../lib/styles';

const POLITICAS = [
  { nombre: 'Prohibido conciliar sin evidencia bancaria', descripcion: 'No se permite marcar conciliado ningún registro sin evidencia bancaria válida.' },
  { nombre: 'Prohibido emitir factura acíclica sin conformidad', descripcion: 'Ninguna factura acíclica puede emitirse sin conformidad del cliente.' },
  { nombre: 'Trazabilidad obligatoria', descripcion: 'Todas las interacciones, decisiones y acciones del agente deben quedar registradas y auditables.' },
  { nombre: 'Revisión humana obligatoria en match de baja confianza', descripcion: 'Todo match con score inferior al umbral definido debe ser revisado por un humano.' },
];

export default function PoliticasCard() {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong }}>Políticas corporativas</div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#475467', background: '#F1F4F8', borderRadius: 5, padding: '3px 8px' }}>Solo lectura</span>
      </div>
      <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
        Estas políticas representan límites corporativos del comportamiento de los agentes y no pueden ser modificadas por usuarios normales.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {POLITICAS.map((p) => (
          <div key={p.nombre} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: '12px 14px', background: '#F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: colors.textMuted, fontSize: 13, marginTop: 1 }}>🔒</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textStrong }}>{p.nombre}</div>
                <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3, lineHeight: 1.5 }}>{p.descripcion}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#475467', background: '#EAECEF', borderRadius: 5, padding: '3px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>Inmutable</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
