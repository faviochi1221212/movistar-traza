/** Valores de motion centralizados (apple-design: springs, no duraciones fijas
 * arbitrarias por componente). Damping 1.0 = critically damped, sin rebote —
 * el default para casi todo. Bounce solo donde el gesto tiene momentum real
 * (drawer/sheet arrastrable). */
export const motionTokens = {
  default: { type: 'spring', bounce: 0, duration: 0.35 } as const,
  fast: { type: 'spring', bounce: 0, duration: 0.22 } as const,
  sheet: { type: 'spring', bounce: 0.15, duration: 0.32 } as const,
  packet: { type: 'spring', bounce: 0, duration: 0.9 } as const,
  crossfade: { duration: 0.18, ease: 'easeOut' } as const,
};

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
