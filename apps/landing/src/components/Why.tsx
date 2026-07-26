import { AppWindowFrame } from "./AppWindowFrame.tsx";

export function Why() {
  return (
    <section id="why" className="relative scroll-mt-24 overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-24 sm:py-32 lg:grid-cols-2 lg:gap-16">
        <div>
          <div data-reveal="" style={{ ["--reveal-delay" as string]: "0ms" }}>
            <p className="font-mono text-xs tracking-wide text-muted-foreground/70">Why Pix</p>
            <p className="mt-4 text-balance text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
              The shell around pi — not a replacement for it.
            </p>
          </div>
          <div
            data-reveal=""
            style={{ ["--reveal-delay" as string]: "80ms" }}
            className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground"
          >
            <p>
              Coding agents improve fastest as CLIs. Pix gives pi a calm desktop home: sessions,
              projects, composer, and terminal mode — while configuration stays on the native agent
              side.
            </p>
            <p>
              Keys, models, packages, and tools match interactive{" "}
              <span className="font-mono text-foreground/90">pi</span>. Chat when you want
              structure; embedded TUI when you want the full terminal. Local-first — no account wall
              for core use.
            </p>
          </div>
        </div>

        <div data-reveal="" style={{ ["--reveal-delay" as string]: "120ms" }} className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-10 -top-8 bottom-0 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.7_0_0/0.12),transparent_70%)] blur-2xl"
          />
          <AppWindowFrame title="Pix — terminal">
            <img
              src="/terminal-session.png"
              alt="Pix embedded pi TUI terminal session"
              className="block h-auto w-full object-cover"
              decoding="async"
            />
          </AppWindowFrame>
        </div>
      </div>
    </section>
  );
}
