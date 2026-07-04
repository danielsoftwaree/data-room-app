import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@repo/ui/components/accordion';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Separator } from '@repo/ui/components/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { cn } from '@repo/ui/lib/utils';

import { Link } from '@tanstack/react-router';

import { colors, radii, spacing, typeScale } from '../lib/tokens';

/**
 * Design System showcase page.
 *
 * A living style guide for the "Discord Analysis" design language documented in
 * docs/design-system/DESIGN-discord.md — deep-indigo canvas lit by Blurple,
 * electric green and vibrant magenta, heavy all-caps display type over
 * generously rounded media. Built from the shared @repo/ui (shadcn) primitives
 * restyled with the Discord tokens exposed in @repo/tailwind-config/theme.css.
 */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-6 scroll-mt-24">
      <div className="flex flex-col gap-1">
        <span className="font-[family-name:var(--font-discord-body)] text-sm font-semibold tracking-[0.2em] text-discord-link uppercase">
          {eyebrow}
        </span>
        <h2 className="font-[family-name:var(--font-discord-display)] text-3xl font-extrabold text-discord-ink uppercase md:text-4xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function DesignSystemScreen() {
  return (
    <div className="min-h-screen bg-discord-canvas font-[family-name:var(--font-discord-body)] text-discord-ink">
      {/* Nav bar */}
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-discord-hairline bg-discord-canvas/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-discord-sm bg-discord-primary text-discord-on-primary">
            ◆
          </span>
          <span className="font-[family-name:var(--font-discord-display)] text-lg font-bold uppercase">
            Discord DS
          </span>
        </div>
        <div className="hidden items-center gap-6 text-sm md:flex">
          <a href="#colors" className="text-discord-ink/80 transition-colors hover:text-discord-ink">
            Colors
          </a>
          <a href="#type" className="text-discord-ink/80 transition-colors hover:text-discord-ink">
            Type
          </a>
          <a href="#components" className="text-discord-ink/80 transition-colors hover:text-discord-ink">
            Components
          </a>
        </div>
        <Button
          asChild
          className="rounded-discord-lg bg-discord-ink px-4 text-discord-ink-dark hover:bg-discord-ink/90"
          size="sm"
        >
          <Link to="/">← Back to app</Link>
        </Button>
      </nav>

      <main className="mx-auto flex max-w-6xl flex-col gap-20 px-6 py-16">
        {/* Hero */}
        <header className="flex flex-col items-start gap-6 rounded-discord-xl bg-discord-canvas py-10">
          <Badge className="rounded-discord-lg bg-discord-magenta px-3 py-1 text-discord-ink">
            Design System · alpha
          </Badge>
          <h1 className="font-[family-name:var(--font-discord-display)] text-5xl leading-none font-extrabold uppercase md:text-7xl">
            Play loud.
            <br />
            <span className="text-discord-primary">Design bold.</span>
          </h1>
          <p className="max-w-2xl text-lg text-discord-ink/80">
            A loud, playful, gaming-native system built on a deep-indigo canvas lit by Blurple,
            electric green, and vibrant magenta. This page is the living reference for its tokens and
            components.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-discord-sm bg-discord-primary px-6 py-5 text-base text-discord-on-primary hover:bg-discord-primary/90">
              Get Started
            </Button>
            <Button className="rounded-discord-sm bg-discord-green px-6 py-5 text-base text-discord-ink-dark hover:bg-discord-green/90">
              Download
            </Button>
          </div>
        </header>

        {/* Marquee band */}
        <div className="-mx-6 overflow-hidden bg-discord-primary py-5">
          <div className="flex flex-wrap justify-center gap-6 px-6 text-center font-[family-name:var(--font-discord-display)] text-2xl font-bold text-discord-ink uppercase md:text-4xl">
            <span>Imagine a place</span>
            <span aria-hidden>✦</span>
            <span>Play together</span>
            <span aria-hidden>✦</span>
            <span>Belong here</span>
          </div>
        </div>

        {/* Colors */}
        <Section id="colors" eyebrow="Foundations" title="Color">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {colors.map((c) => (
              <div
                key={c.token}
                className="overflow-hidden rounded-discord-md border border-discord-hairline bg-discord-surface-indigo"
              >
                <div className="h-24 w-full" style={{ backgroundColor: c.value }} />
                <div className="flex flex-col gap-0.5 p-3">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-discord-ink/60">{c.value}</span>
                  <code className="text-xs text-discord-link">bg-{c.token}</code>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section id="type" eyebrow="Foundations" title="Typography">
          <p className="-mt-2 max-w-2xl text-sm text-discord-ink/70">
            Display and heading type use <strong>ABC Ginto Nord</strong>; body uses{' '}
            <strong>ggsans</strong> / ABC Ginto. Those are proprietary fonts — this page approximates
            them with a heavy sans fallback stack, so weights and scale are representative.
          </p>
          <div className="flex flex-col divide-y divide-discord-hairline rounded-discord-lg border border-discord-hairline bg-discord-surface-indigo">
            {typeScale.map((t) => (
              <div key={t.name} className="flex flex-col gap-2 p-5 md:flex-row md:items-baseline md:gap-6">
                <div className="w-40 shrink-0 text-xs text-discord-ink/60">
                  <div className="font-mono text-discord-link">{t.name}</div>
                  <div>{t.family}</div>
                  <div>
                    {t.size} · {t.weight}
                  </div>
                </div>
                <div
                  className="truncate"
                  style={{
                    fontSize: `min(${t.size}, 8vw)`,
                    fontWeight: t.weight,
                    fontFamily: t.family.includes('Nord')
                      ? 'var(--font-discord-display)'
                      : 'var(--font-discord-body)',
                  }}
                >
                  {t.sample}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Radii & spacing */}
        <Section id="scale" eyebrow="Foundations" title="Radius & Spacing">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="gap-4 rounded-discord-lg border-discord-hairline bg-discord-surface-indigo py-5 text-discord-ink">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-discord-display)] uppercase">
                  Radius
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4">
                {radii.map((r) => (
                  <div key={r.token} className="flex flex-col items-center gap-2">
                    <div
                      className="size-16 border-2 border-discord-primary bg-discord-primary/20"
                      style={{ borderRadius: r.value }}
                    />
                    <span className="text-xs text-discord-ink/70">
                      {r.name} · {r.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="gap-4 rounded-discord-lg border-discord-hairline bg-discord-surface-indigo py-5 text-discord-ink">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-discord-display)] uppercase">
                  Spacing
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {spacing.map((s) => (
                  <div key={s.name} className="flex items-center gap-4">
                    <span className="w-20 text-xs text-discord-ink/70">
                      {s.name} · {s.value}
                    </span>
                    <div className="h-4 rounded-discord-xs bg-discord-green" style={{ width: s.value * 4 }} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </Section>

        <Separator className="bg-discord-hairline" />

        {/* Components */}
        <Section id="components" eyebrow="Library" title="Components">
          {/* Buttons */}
          <div className="flex flex-col gap-4">
            <h3 className="font-[family-name:var(--font-discord-display)] text-xl uppercase">Buttons</h3>
            <div className="flex flex-wrap items-center gap-3 rounded-discord-lg border border-discord-hairline bg-discord-surface-indigo p-6">
              <Button className="rounded-discord-sm bg-discord-primary px-6 py-5 text-base text-discord-on-primary hover:bg-discord-primary/90">
                Primary
              </Button>
              <Button className="rounded-discord-sm bg-discord-green px-6 py-5 text-base text-discord-ink-dark hover:bg-discord-green/90">
                Green
              </Button>
              <Button className="rounded-discord-lg bg-discord-ink px-4 text-discord-ink-dark hover:bg-discord-ink/90">
                White
              </Button>
              <Button className="rounded-discord-lg bg-discord-surface-onyx px-4 text-discord-ink hover:bg-discord-surface-onyx/80">
                Ghost
              </Button>
              <Button className="rounded-discord-xs bg-discord-surface-onyx px-8 text-discord-ink hover:bg-discord-surface-onyx/80" size="sm">
                Ghost SM
              </Button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col gap-4">
            <h3 className="font-[family-name:var(--font-discord-display)] text-xl uppercase">Badges</h3>
            <div className="flex flex-wrap items-center gap-3 rounded-discord-lg border border-discord-hairline bg-discord-surface-indigo p-6">
              <Badge className="rounded-discord-lg bg-discord-magenta px-3 py-1 text-discord-ink">New</Badge>
              <Badge className="rounded-discord-lg bg-discord-primary px-3 py-1 text-discord-on-primary">Nitro</Badge>
              <Badge className="rounded-discord-lg bg-discord-green px-3 py-1 text-discord-ink-dark">Online</Badge>
              <Badge variant="outline" className="rounded-discord-lg border-discord-hairline px-3 py-1 text-discord-ink">
                Beta
              </Badge>
            </div>
          </div>

          {/* Feature / stat / step cards */}
          <div className="flex flex-col gap-4">
            <h3 className="font-[family-name:var(--font-discord-display)] text-xl uppercase">Cards</h3>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="flex flex-col gap-3 rounded-discord-xl bg-discord-magenta p-8 text-discord-ink">
                <span className="font-[family-name:var(--font-discord-display)] text-2xl uppercase">
                  Feature
                </span>
                <p className="text-discord-ink/90">
                  Gradient feature panel — the loud, full-bleed magenta surface for headline moments.
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-discord-xl bg-discord-surface-indigo p-8">
                <span className="font-[family-name:var(--font-discord-display)] text-2xl uppercase">
                  Dark
                </span>
                <p className="text-discord-ink/80">
                  Indigo feature card for calmer, secondary content blocks.
                </p>
              </div>
              <div className="flex flex-col justify-between gap-3 rounded-discord-xl bg-discord-primary p-8 text-discord-ink">
                <span className="font-[family-name:var(--font-discord-display)] text-5xl font-extrabold">
                  150M+
                </span>
                <span className="text-discord-ink/90">Monthly active players (stat card).</span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {['Create a server', 'Invite your crew', 'Jump into voice'].map((step, i) => (
                <div key={step} className="flex items-center gap-4 rounded-discord-lg bg-discord-magenta p-6 text-discord-ink">
                  <span className="grid size-10 shrink-0 place-items-center rounded-discord-full bg-discord-ink/20 font-[family-name:var(--font-discord-display)] text-lg">
                    {i + 1}
                  </span>
                  <span className="font-[family-name:var(--font-discord-display)] text-lg uppercase">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Showcase band (black) */}
          <div className="flex flex-col items-start gap-4 rounded-discord-xl bg-discord-surface-black p-10">
            <span className="font-[family-name:var(--font-discord-display)] text-3xl uppercase md:text-4xl">
              Full-bleed showcase band
            </span>
            <p className="max-w-xl text-discord-ink/70">
              Onyx/black surface used to frame media and product shots against the indigo canvas.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-col gap-4">
            <h3 className="font-[family-name:var(--font-discord-display)] text-xl uppercase">Tabs</h3>
            <Tabs defaultValue="voice" className="rounded-discord-lg border border-discord-hairline bg-discord-surface-indigo p-6">
              <TabsList className="bg-discord-canvas">
                <TabsTrigger value="voice" className="data-[state=active]:bg-discord-primary data-[state=active]:text-discord-on-primary">
                  Voice
                </TabsTrigger>
                <TabsTrigger value="video" className="data-[state=active]:bg-discord-primary data-[state=active]:text-discord-on-primary">
                  Video
                </TabsTrigger>
                <TabsTrigger value="stage" className="data-[state=active]:bg-discord-primary data-[state=active]:text-discord-on-primary">
                  Stage
                </TabsTrigger>
              </TabsList>
              <TabsContent value="voice" className="pt-4 text-discord-ink/80">
                Crystal-clear voice channels to hang out with your community.
              </TabsContent>
              <TabsContent value="video" className="pt-4 text-discord-ink/80">
                Go live and stream games or screen-share with up to your whole squad.
              </TabsContent>
              <TabsContent value="stage" className="pt-4 text-discord-ink/80">
                Stage channels for talks, Q&amp;As, and community events.
              </TabsContent>
            </Tabs>
          </div>

          {/* FAQ accordion */}
          <div className="flex flex-col gap-4">
            <h3 className="font-[family-name:var(--font-discord-display)] text-xl uppercase">FAQ</h3>
            <div className="rounded-discord-lg border border-discord-hairline bg-discord-surface-indigo px-6">
              <Accordion type="single" collapsible>
                <AccordionItem value="q1" className="border-discord-hairline">
                  <AccordionTrigger className="text-base text-discord-ink hover:no-underline">
                    Is Discord free?
                  </AccordionTrigger>
                  <AccordionContent className="text-discord-ink/70">
                    Yes — Discord is free to use, with optional Nitro upgrades.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q2" className="border-discord-hairline">
                  <AccordionTrigger className="text-base text-discord-ink hover:no-underline">
                    Can I use it on any device?
                  </AccordionTrigger>
                  <AccordionContent className="text-discord-ink/70">
                    Discord works on web, desktop, and mobile with the same account.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q3" className="border-discord-hairline">
                  <AccordionTrigger className="text-base text-discord-ink hover:no-underline">
                    How big can a server get?
                  </AccordionTrigger>
                  <AccordionContent className="text-discord-ink/70">
                    From a handful of friends to hundreds of thousands of members.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </Section>

        {/* CTA band */}
        <div className="flex flex-col items-center gap-6 rounded-discord-xl bg-discord-primary p-12 text-center">
          <h2 className="font-[family-name:var(--font-discord-display)] text-4xl font-extrabold text-discord-ink uppercase md:text-5xl">
            Ready to start?
          </h2>
          <Button className="rounded-discord-sm bg-discord-ink px-8 py-6 text-lg text-discord-ink-dark hover:bg-discord-ink/90">
            Open Discord
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-discord-hairline bg-discord-canvas px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 text-sm text-discord-ink/60 md:flex-row md:items-center">
          <span className="font-[family-name:var(--font-discord-display)] text-base text-discord-ink uppercase">
            Discord Design System
          </span>
          <span>Generated from docs/design-system/DESIGN-discord.md</span>
        </div>
      </footer>
    </div>
  );
}
