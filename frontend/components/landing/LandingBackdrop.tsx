"use client";

/** Crisp white canvas with subtle enterprise ambient radial gradients */
export function LandingBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#FFFFFF]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(15, 23, 42, 0.04), transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 15%, rgba(15, 23, 42, 0.02), transparent 50%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(to right, #0f172a 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}
