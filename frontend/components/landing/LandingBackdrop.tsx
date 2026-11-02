"use client";

/** Deep obsidian control room canvas with subtle ambient radial gradients and grid */
export function LandingBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#070707]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 75% 45% at 50% -5%, rgba(255, 255, 255, 0.07), transparent 60%),
            radial-gradient(ellipse 50% 35% at 85% 20%, rgba(255, 255, 255, 0.03), transparent 50%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
