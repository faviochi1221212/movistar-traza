import { useState } from 'react';
import { colors, monoFont } from '../../lib/styles';
import { api } from '../../lib/api';

type Regla = { id: string; codigo: string; modulo: string; nombre: string; descripcion: string | null; tipo_valor: string; valor: any; unidad: string | null; activo: boolean };

const AREA_COLOR: Record<string, { fg: string; bg: string }> = {
  BI: { fg: colors.blueDark, bg: colors.blueBg },
  COBRANZAS: { fg: colors.amberDark, bg: colors.amberBg },
  FACTURACION: { fg: colors.greenDark, bg: colors.greenBg },
  RECAUDO: { fg: '#6D28D9', bg: '#F1EBFC' },
};
const AREA_LABEL: Record<string, string> = { BI: 'BI', COBRANZAS: 'Cobranzas', FACTURACION: 'Facturación', RECAUDO: 'Recaudo' };

function validar(unidad: string | null, valor: string): string | null {
  const n = Number(valor);
  if (Number.isNaN(n)) return 'Debe ser un número.';
  if (unidad === 'probabilidad' || unidad === 'score') {
    if (n < 0 || n > 1) return 'Debe estar entre 0 y 1.';
  }
  if (unidad === 'días' || unidad === 'dias' || unidad === 'horas') {
    if (n < 0 || !Number.isInteger(n)) return 'Debe ser un entero positivo.';
  }
  return null;
}

export default function ReglasCard({ reglas, onGuardado, onVerAuditoria }: { reglas: Regla[]; onGuardado: () => void; onVerAuditoria: () => void }) {
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);

  const cambios = Object.keys(editando).filter((cod) => {
    const r = reglas.find((x) => x.codigo === cod);
    return r && editando[cod] !== String(r.valor);
  });

  const onChange = (codigo: string, unidad: string | null, valor: string) => {
    setEditando((s) => ({ ...s, [codigo]: valor }));
    const err = validar(unidad, valor);
    setErrores((s) => ({ ...s, [codigo]: err || '' }));
  };

  const guardarTodo = async () => {
    const pendientes = cambios.filter((cod) => !errores[cod]);
    if (pendientes.length === 0) return;
    setGuardando(true);
    try {
      await Promise.all(pendientes.map((codigo) => api.put(`/api/configuracion/reglas/${codigo}`, { valor: Number(editando[codigo]) })));
      setEditando({});
      setErrores({});
      setUltimoGuardado(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
      onGuardado();
    } finally {
      setGuardando(false);
    }
  };

  const hayErrores = cambios.some((cod) => errores[cod]);

  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Reglas operativas</div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: colors.blueDark, background: colors.blueBg, borderRadius: 5, padding: '3px 8px' }}>Editables</span>
          </div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 6, maxWidth: 480, lineHeight: 1.5 }}>
            Ajusta los umbrales y comportamientos que utilizan los agentes durante la operación. Los cambios guardados se aplican según las reglas del proceso y quedan registrados en Auditoría.
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <button
            onClick={guardarTodo}
            disabled={cambios.length === 0 || hayErrores || guardando}
            style={{
              height: 38, padding: '0 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600,
              background: cambios.length > 0 && !hayErrores ? colors.blue : '#CBD5E1', color: '#fff',
              cursor: cambios.length > 0 && !hayErrores && !guardando ? 'pointer' : 'default',
            }}
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <div style={{ fontSize: 11, color: cambios.length > 0 ? colors.amberDark : colors.textFaint, marginTop: 6, fontWeight: 600 }}>
            {cambios.length > 0 ? 'Cambios sin guardar' : ultimoGuardado ? `Último guardado: hoy ${ultimoGuardado}` : 'Sin cambios'}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={th('left')}>ÁREA</th>
              <th style={th('left')}>REGLA</th>
              <th style={th('right')}>VALOR ACTUAL</th>
              <th style={th('left')}>UNIDAD</th>
              <th style={th('left')}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {reglas.map((r) => {
              const area = AREA_COLOR[r.modulo] || { fg: colors.textMuted, bg: '#F1F4F8' };
              const valorActual = editando[r.codigo] ?? String(r.valor);
              const error = errores[r.codigo];
              return (
                <tr key={r.id}>
                  <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, color: area.fg, background: area.bg, borderRadius: 5, padding: '3px 8px' }}>{AREA_LABEL[r.modulo] || r.modulo}</span></td>
                  <td style={td}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{r.nombre}</div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2, maxWidth: 260 }}>{r.descripcion}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input
                      value={valorActual}
                      onChange={(e) => onChange(r.codigo, r.unidad, e.target.value)}
                      style={{ ...monoFont, height: 34, width: 90, textAlign: 'right', border: `1px solid ${error ? colors.red : colors.border}`, borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none' }}
                    />
                    {error && <div style={{ fontSize: 10.5, color: colors.redDark, marginTop: 3 }}>{error}</div>}
                  </td>
                  <td style={{ ...td, fontSize: 12.5, color: colors.textMuted }}>{r.unidad}</td>
                  <td style={td}><span style={{ fontSize: 10.5, fontWeight: 600, color: colors.greenDark, background: colors.greenBg, borderRadius: 5, padding: '3px 8px' }}>Activa</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 16, lineHeight: 1.5 }}>
        Los cambios guardados quedan registrados automáticamente. Consulta el historial completo en <span onClick={onVerAuditoria} style={{ color: colors.blueDark, fontWeight: 600, cursor: 'pointer' }}>Auditoría</span>.
      </div>
    </div>
  );
}

const th = (align: 'left' | 'right'): React.CSSProperties => ({ textAlign: align, fontSize: 10.5, fontWeight: 600, color: colors.textMuted, letterSpacing: 0.3, padding: '9px 14px', borderBottom: `1px solid ${colors.border}` });
const td: React.CSSProperties = { padding: '12px 14px', borderBottom: `1px solid ${colors.borderLight}`, verticalAlign: 'top' };
