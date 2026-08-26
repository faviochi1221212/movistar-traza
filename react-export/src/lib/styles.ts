import type { CSSProperties } from 'react';

export function tagStyle(fg: string, bg: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 24,
    padding: '0 10px',
    borderRadius: 6,
    background: bg,
    color: fg,
    fontSize: 12,
    fontWeight: 600,
  };
}

export function priorityStyle(p: string): CSSProperties {
  if (p === 'Alta') return tagStyle('#B91C1C', '#FEF2F2');
  if (p === 'Media') return tagStyle('#B45309', '#FFFBEB');
  return tagStyle('#475467', '#F1F4F8');
}

export function tabStyle(active: boolean): CSSProperties {
  return {
    height: 36,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    color: active ? '#0F172A' : '#64748B',
    borderBottom: active ? '2px solid #2E6CE8' : '2px solid transparent',
  };
}

export function pagoProbStyle(p: number): CSSProperties {
  if (p >= 65) return tagStyle('#15803D', '#ECFDF3');
  if (p >= 45) return tagStyle('#B45309', '#FFFBEB');
  return tagStyle('#B91C1C', '#FEF2F2');
}

export const colors = {
  navy: '#071E36',
  blue: '#2E6CE8',
  blueDark: '#2050C4',
  blueBg: '#EAF1FC',
  bg: '#F5F7FA',
  border: '#E2E5EA',
  borderLight: '#EEF1F4',
  text: '#1A2433',
  textStrong: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  green: '#16A34A',
  greenDark: '#15803D',
  greenBg: '#ECFDF3',
  red: '#DC2626',
  redDark: '#B91C1C',
  redBg: '#FEF2F2',
  amber: '#D97706',
  amberDark: '#B45309',
  amberBg: '#FFFBEB',
};

export const monoFont: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace' };
