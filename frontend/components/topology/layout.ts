/**
 * Deterministic hardcoded grid layout for live topology nodes.
 *
 * Kept as a named helper (no external layout library) so node positions stay
 * stable across renders and are trivially testable.
 */
export function computeNodePosition(index: number, columns = 4): { x: number; y: number } {
  return {
    x: 120 + (index % columns) * 160,
    y: 150 + Math.floor(index / columns) * 120,
  };
}
