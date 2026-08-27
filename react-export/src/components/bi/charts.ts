export type ChartPoint = { label: string; value: number };
export type ChartSpec = {
  type: 'bar' | 'line';
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  format?: 'money' | 'percent' | 'number';
};

export function formatValue(v: number, format?: ChartSpec['format']): string {
  if (format === 'percent') return `${(v * 100).toFixed(1)}%`;
  if (format === 'money') return `S/ ${v.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
  return v.toLocaleString('es-PE', { maximumFractionDigits: 0 });
}
