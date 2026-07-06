import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import {
  ArrowRightIcon,
  FolderLockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadCloudIcon,
  UsersIcon,
} from 'lucide-react';
import { VaultIcon } from '@phosphor-icons/react';

/**
 * Marketing landing shown to signed-out visitors (rendered inside <SignedOut>).
 * The CTAs open Clerk's hosted auth in a modal; on success Clerk flips the app
 * into <SignedIn> and the visitor lands in the workspace, where they can spin
 * up their first data room. Always dark-indigo canvas per the Discord design
 * language, independent of the in-app light/dark theme.
 */
export function LandingScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-discord-canvas font-discord-body text-discord-ink">
      <BackdropMesh />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6">
        <Nav />
        <Hero />
        <ScreenshotShowcase />
        <Features />
        <Steps />
        <CtaBand />
        <Footer />
      </div>
    </div>
  );
}

function Nav() {
  return (
    <nav className="flex h-20 items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-discord-md bg-discord-primary text-discord-on-primary">
          <VaultIcon weight="fill" className="size-6" />
        </span>
        <span className="font-discord-display text-lg font-extrabold tracking-tight">
          Data Room
        </span>
      </div>
      <SignInButton mode="modal">
        <button className="rounded-discord-lg bg-discord-surface-indigo px-5 py-2.5 text-sm font-semibold text-discord-ink transition-transform hover:scale-[1.03]">
          Log in
        </button>
      </SignInButton>
    </nav>
  );
}

function Hero() {
  return (
    <header className="flex flex-col items-center py-16 text-center sm:py-24">
      <span className="mb-6 inline-flex items-center gap-2 rounded-discord-pill bg-discord-magenta/15 px-4 py-1.5 text-sm font-semibold text-discord-magenta">
        <SparklesIcon className="size-4" />
        Secure due-diligence, minus the friction
      </span>
      <h1 className="font-discord-display text-5xl font-extrabold uppercase leading-[1.02] tracking-tight sm:text-7xl">
        Your documents.
        <br />
        <span className="bg-gradient-to-r from-discord-primary via-violet-400 to-discord-magenta bg-clip-text text-transparent">
          Locked down. Shared fast.
        </span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-discord-ink/70">
        Spin up a private data room in seconds. Organize folders, upload PDFs, invite your team,
        and keep every sensitive file exactly where it belongs.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <SignUpButton mode="modal">
          <button className="inline-flex items-center gap-2 rounded-discord-sm bg-discord-green px-8 py-4 text-lg font-bold text-discord-ink-dark transition-transform hover:scale-[1.03]">
            Get started free
            <ArrowRightIcon className="size-5" />
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button className="rounded-discord-sm bg-discord-primary px-8 py-4 text-lg font-semibold text-discord-on-primary transition-transform hover:scale-[1.03]">
            I already have an account
          </button>
        </SignInButton>
      </div>
      <p className="mt-4 text-sm text-discord-ink/50">
        No credit card. Create your first room in under a minute.
      </p>
    </header>
  );
}

function ScreenshotShowcase() {
  return (
    <div className="pb-16">
      <div className="rounded-discord-xl bg-discord-surface-black p-3 shadow-[0_3px_120px_rgba(69,42,124,0.45)] sm:p-5">
        <img
          src="/screen.png"
          alt="Data Room application interface"
          className="w-full rounded-discord-lg"
          loading="lazy"
        />
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: FolderLockIcon,
    title: 'Private data rooms',
    body: 'Each room is an isolated, secure space. Nest folders, drop in files, keep due-diligence tidy.',
    tone: 'dark' as const,
  },
  {
    icon: UsersIcon,
    title: 'Invite your team',
    body: 'Bring collaborators into the organization and control who sees what, per room.',
    tone: 'gradient' as const,
  },
  {
    icon: UploadCloudIcon,
    title: 'Upload & preview PDFs',
    body: 'Drag in documents and read them inline. No downloads, no clunky viewers.',
    tone: 'dark' as const,
  },
  {
    icon: ShieldCheckIcon,
    title: 'Yours alone',
    body: 'Auth-gated by default. Your files stay behind your login, attributed to your account.',
    tone: 'dark' as const,
  },
];

function Features() {
  return (
    <section className="grid gap-5 pb-16 sm:grid-cols-2">
      {FEATURES.map((feature) => {
        const Icon = feature.icon;
        const isGradient = feature.tone === 'gradient';
        return (
          <div
            key={feature.title}
            className={
              isGradient
                ? 'rounded-discord-xl bg-gradient-to-br from-discord-magenta to-discord-primary p-8'
                : 'rounded-discord-xl bg-discord-surface-indigo p-8'
            }
          >
            <span className="grid size-12 place-items-center rounded-discord-md bg-white/15">
              <Icon className="size-6" />
            </span>
            <h3 className="mt-5 font-discord-display text-xl font-bold">{feature.title}</h3>
            <p className="mt-2 leading-relaxed text-discord-ink/75">{feature.body}</p>
          </div>
        );
      })}
    </section>
  );
}

const STEPS = [
  { n: '01', title: 'Sign up', body: 'Create your account and land straight in your organization.' },
  { n: '02', title: 'Create a data room', body: 'Name it, and your private secure space is ready instantly.' },
  { n: '03', title: 'Upload & share', body: 'Add folders and PDFs, invite the team, get to work.' },
];

function Steps() {
  return (
    <section className="pb-16">
      <h2 className="mb-8 text-center font-discord-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
        Up and running in 3 steps
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.n} className="rounded-discord-lg bg-discord-surface-indigo p-6">
            <span className="font-discord-display text-4xl font-extrabold text-discord-primary">
              {step.n}
            </span>
            <h3 className="mt-3 font-discord-display text-lg font-bold">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-discord-ink/70">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="mb-16 rounded-discord-xl bg-discord-primary px-8 py-14 text-center">
      <h2 className="font-discord-display text-4xl font-extrabold uppercase leading-tight tracking-tight sm:text-5xl">
        Ready when you are
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-discord-ink/80">
        Create your first data room today. It takes less than a minute.
      </p>
      <div className="mt-8 flex justify-center">
        <SignUpButton mode="modal">
          <button className="inline-flex items-center gap-2 rounded-discord-sm bg-discord-green px-8 py-4 text-lg font-bold text-discord-ink-dark transition-transform hover:scale-[1.03]">
            Get started free
            <ArrowRightIcon className="size-5" />
          </button>
        </SignUpButton>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-10">
      <p className="text-center font-discord-display text-5xl font-extrabold uppercase tracking-tight text-white/10 sm:text-7xl">
        Data Room
      </p>
    </footer>
  );
}

function BackdropMesh() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute -left-32 -top-32 size-[36rem] rounded-full bg-discord-primary/30 blur-[120px]" />
      <div className="absolute -right-40 top-40 size-[32rem] rounded-full bg-discord-magenta/20 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 size-[30rem] rounded-full bg-violet-600/20 blur-[120px]" />
    </div>
  );
}
