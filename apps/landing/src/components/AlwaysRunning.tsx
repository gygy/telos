import { AppWindowFrame } from "./AppWindowFrame.tsx";

export function AlwaysRunning() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div data-reveal="" style={{ ["--reveal-delay" as string]: "0ms" }}>
          <p className="font-mono text-xs tracking-wide text-muted-foreground/70">Always ready</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Close the noise. Keep the agent.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Pix is a view onto pi — not a harness that reimplements the agent. When you need focus,
            collapse to the session that matters; when you need the CLI, open terminal mode on the
            same thread.
          </p>
        </div>
        <div data-reveal="" style={{ ["--reveal-delay" as string]: "100ms" }}>
          <AppWindowFrame title="Pix — new session">
            <img
              src="/empty-conversation.png"
              alt="Pix empty conversation — start without a project"
              className="block h-auto w-full object-cover"
              decoding="async"
            />
          </AppWindowFrame>
        </div>
      </div>
    </section>
  );
}
