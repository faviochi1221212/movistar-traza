import { useState } from 'react';
import { colors } from '../../lib/styles';

export type ResultColumn = { key: string; label: string; align?: 'left' | 'right'; render?: (row: Record<string, any>) => React.ReactNode };
export type ResultTableSpec = { columns: ResultColumn[]; rows: Record<string, any>[]; csvNombre?: string };

/** Tabla generica para respuestas del copiloto (seccion 16 del prompt: el
 * chatbot debe poder devolver tablas ademas de texto). */
export default function BIResultTable({ spec }: { spec: ResultTableSpec }) {
  const [pagina, setPagina] = useState(0);
  const pageSize = 5;
  const totalPaginas = Math.max(1, Math.ceil(spec.rows.length / pageSize));
  const visibles = spec.rows.slice(pagina * pageSize, pagina * pageSize + pageSize);

  const exportar = () => {
    const header = spec.columns.map((c) => c.label).join(',') + '\n';
    const rows = spec.rows.map((r) => spec.columns.map((c) => `"${String(r[c.key] ?? '')}"`).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.csvNombre || 'resultado'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ marginTop: 8, background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
          <thead>
            <tr>
              {spec.columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align || 'left', fontSize: 10, fontWeight: 600, color: colors.textFaint, padding: '4px 6px', borderBottom: `1px solid ${colors.borderLight}`, whiteSpace: 'nowrap' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((row, i) => (
              <tr key={i}>
                {spec.columns.map((c) => (
                  <td key={c.key} style={{ padding: '6px 6px', fontSize: 11.5, color: colors.text, borderBottom: `1px solid ${colors.borderLight}`, textAlign: c.align || 'left', whiteSpace: 'nowrap' }}>
                    {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 10.5, color: colors.textFaint }}>
        <span>{pagina * pageSize + 1}–{Math.min(spec.rows.length, pagina * pageSize + visibles.length)} de {spec.rows.length}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span onClick={() => pagina > 0 && setPagina(pagina - 1)} style={{ cursor: pagina > 0 ? 'pointer' : 'default', opacity: pagina > 0 ? 1 : 0.3 }}>‹</span>
          <span>{pagina + 1} / {totalPaginas}</span>
          <span onClick={() => pagina < totalPaginas - 1 && setPagina(pagina + 1)} style={{ cursor: pagina < totalPaginas - 1 ? 'pointer' : 'default', opacity: pagina < totalPaginas - 1 ? 1 : 0.3 }}>›</span>
        </div>
      </div>
      <button onClick={exportar} style={{ marginTop: 8, height: 24, padding: '0 10px', borderRadius: 6, border: `1px solid ${colors.border}`, background: '#fff', color: colors.textMuted, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>⭳ Exportar</button>
    </div>
  );
}

export function riesgoBadge(nivel: string | undefined | null): { label: string; fg: string; bg: string } {
  if (nivel === 'ALTO') return { label: 'Alto', fg: colors.redDark, bg: colors.redBg };
  if (nivel === 'MEDIO') return { label: 'Medio', fg: colors.amberDark, bg: colors.amberBg };
  if (nivel === 'BAJO') return { label: 'Bajo', fg: colors.greenDark, bg: colors.greenBg };
  return { label: 'Sin evaluar', fg: colors.textFaint, bg: '#F1F4F8' };
}
