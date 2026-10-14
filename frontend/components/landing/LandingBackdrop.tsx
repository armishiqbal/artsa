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
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37, 99, 235, 0.08), transparent 60%),
            radial-gradient(ellipse 50% 40% at 90% 15%, rgba(99, 102, 241, 0.05), transparent 50%),
            radial-gradient(ellipse 60% 40% at 10% 40%, rgba(14, 165, 233, 0.04), transparent 50%)
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
