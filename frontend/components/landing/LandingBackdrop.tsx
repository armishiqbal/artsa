"use client";

/** Dovetail grid wireframe — 1px #1e1e1e cells on #0a0a0a canvas. */
export function LandingBackdrop() {
  return (
    <div className="lp-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="lp-backdrop__base" />
      <div className="lp-backdrop__grid" />
      <div className="lp-backdrop__vignette" />
    </div>
  );
}
