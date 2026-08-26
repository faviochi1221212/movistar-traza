import { colors } from '../lib/styles';

export type FilterOption = { value: string; label: string };

/** Dropdown de filtro reusado en las tablas del proyecto. Las opciones son
 * fijas (estados/categorias del negocio), no calculadas dinamicamente desde
 * los datos (ver decision de alcance: "dropdown simple", no estilo Excel). */
export default function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: FilterOption[];
}) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.textMuted, marginBottom: 5 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36, minWidth: 150, border: `1px solid ${colors.border}`, borderRadius: 7,
          background: '#fff', padding: '0 10px', fontSize: 13, color: colors.textStrong, outline: 'none',
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
