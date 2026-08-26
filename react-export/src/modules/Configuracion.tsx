import { useEffect, useState } from 'react';
import { colors } from '../lib/styles';
import { api } from '../lib/api';

type Regla = { id: string; codigo: string; modulo: string; nombre: string; descripcion: string | null; tipo_valor: string; valor: any; unidad: string | null };

export default function Configuracion() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = () => api.get<Regla[]>('/api/configuracion/reglas').then(setReglas);
  useEffect(() => { cargar(); }, []);

  const guardar = async (codigo: string) => {
    const raw = editando[codigo];
    if (raw === undefined) return;
    setGuardando(codigo);
    const valor = Number.isNaN(Number(raw)) ? raw : Number(raw);
    try {
      await api.put(`/api/configuracion/reglas/${codigo}`, { valor });
      await cargar();
      setEditando((e) => { const c = { ...e }; delete c[codigo]; return c; });
    } finally {
      setGuardando(null);
    }
  };

  const grupos = reglas.reduce<Record<string, Regla[]>>((acc, r) => {
    (acc[r.modulo] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Configuración</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4 }}>Reglas de negocio configurables que usa TRAZA para automatizar decisiones.</div>
      </div>

      {Object.entries(grupos).map(([modulo, items]) => (
        <div key={modulo} style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.border}`, fontSize: 14, fontWeight: 700, color: colors.textStrong }}>{modulo}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {items.map((r) => {
                const valorActual = editando[r.codigo] ?? String(r.valor);
                const cambiado = editando[r.codigo] !== undefined && editando[r.codigo] !== String(r.valor);
                return (
                  <tr key={r.id}>
                    <td style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.borderLight}`, width: '45%' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.textStrong }}>{r.nombre}</div>
                      <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{r.descripcion}</div>
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: `1px solid ${colors.borderLight}` }}>
                      <input value={valorActual} onChange={(e) => setEditando((s) => ({ ...s, [r.codigo]: e.target.value }))}
                        style={{ height: 36, width: 110, border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 10px', fontSize: 13, outline: 'none' }} />
                      {r.unidad && <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 8 }}>{r.unidad}</span>}
                    </td>
                    <td style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.borderLight}`, textAlign: 'right' }}>
                      <button disabled={!cambiado || guardando === r.codigo} onClick={() => guardar(r.codigo)}
                        style={{ ...btnDark, opacity: cambiado ? 1 : 0.4, cursor: cambiado ? 'pointer' : 'default' }}>
                        {guardando === r.codigo ? 'Guardando…' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {reglas.length === 0 && <div style={{ fontSize: 13, color: colors.textFaint }}>Cargando reglas…</div>}
    </div>
  );
}

const btnDark: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 7, border: 'none', background: colors.navy, color: '#fff', fontSize: 13, fontWeight: 600 };
