type LegalSection = {
  title: string;
  body: string[];
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string[];
  sections: LegalSection[];
}) {
  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[980px] gap-8 pb-16"
    >
      <section className="relative overflow-hidden rounded-card border border-edge bg-dusk-deep px-8 py-10 text-cream shadow-float max-md:px-5 max-md:py-7">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.18),rgba(134,186,218,0.10)_45%,rgba(255,227,179,0.14))]"
        />
        <div className="relative z-10 max-w-[70ch]">
          <p className="text-kicker font-bold uppercase text-glow/80">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-page-title leading-tight">{title}</h1>
          <div className="mt-5 grid gap-4 text-sm leading-relaxed text-cream/78">
            {intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {sections.map((section) => (
          <article
            className="rounded-card border border-edge bg-surface px-6 py-5 shadow-rest max-md:px-5"
            key={section.title}
          >
            <h2 className="text-xl font-medium text-ink">{section.title}</h2>
            <div className="mt-3 grid gap-3 text-sm leading-relaxed text-ink-soft">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
