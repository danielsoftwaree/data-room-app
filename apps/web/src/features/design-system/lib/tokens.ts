/**
 * Design tokens mirrored from docs/design-system/DESIGN-discord.md.
 * Kept here (feature-local) purely to drive the showcase page's data-driven
 * sections; the canonical CSS custom properties live in
 * @repo/tailwind-config/theme.css (--color-discord-*, --radius-discord-*).
 */

export type Swatch = { name: string; token: string; value: string; onDark?: boolean };

export const colors: Swatch[] = [
  { name: 'primary (Blurple)', token: 'discord-primary', value: '#5865f2' },
  { name: 'on-primary', token: 'discord-on-primary', value: '#ffffff' },
  { name: 'green', token: 'discord-green', value: '#35ed7e' },
  { name: 'magenta', token: 'discord-magenta', value: '#ec48bd' },
  { name: 'link', token: 'discord-link', value: '#00b0f4' },
  { name: 'canvas', token: 'discord-canvas', value: '#0a0d3a' },
  { name: 'surface-indigo', token: 'discord-surface-indigo', value: '#1e2353' },
  { name: 'surface-onyx', token: 'discord-surface-onyx', value: '#23272a' },
  { name: 'surface-black', token: 'discord-surface-black', value: '#000000' },
  { name: 'ink', token: 'discord-ink', value: '#ffffff' },
  { name: 'muted', token: 'discord-muted', value: '#333333' },
  { name: 'hairline', token: 'discord-hairline', value: '#23272a' },
];

export type TypeScale = {
  name: string;
  family: string;
  size: string;
  weight: number;
  sample: string;
};

export const typeScale: TypeScale[] = [
  { name: 'display-xl', family: 'ABC Ginto Nord', size: '82px', weight: 800, sample: 'PLAY LOUD' },
  { name: 'display-lg', family: 'ABC Ginto Nord', size: '62px', weight: 800, sample: 'LEVEL UP' },
  { name: 'display-md', family: 'ABC Ginto Nord', size: '56px', weight: 700, sample: 'GG WELL PLAYED' },
  { name: 'heading-lg', family: 'ABC Ginto Nord', size: '48px', weight: 700, sample: 'Squad Goals' },
  { name: 'heading-sm', family: 'ABC Ginto Nord', size: '22px', weight: 700, sample: 'Voice Channels' },
  { name: 'body-lg', family: 'ABC Ginto', size: '20px', weight: 500, sample: 'Hang out with your people.' },
  { name: 'body', family: 'ggsans', size: '16px', weight: 400, sample: 'Discord is where you can be yourself and hang out.' },
  { name: 'link', family: 'ABC Ginto', size: '16px', weight: 500, sample: 'Learn more →' },
];

export type SpaceToken = { name: string; value: number };

export const spacing: SpaceToken[] = [
  { name: 'xxs', value: 4 },
  { name: 'xs', value: 8 },
  { name: 'sm', value: 12 },
  { name: 'md', value: 16 },
  { name: 'lg', value: 20 },
  { name: 'xl', value: 24 },
  { name: 'xxl', value: 32 },
  { name: 'section', value: 40 },
];

export type RadiusToken = { name: string; token: string; value: string };

export const radii: RadiusToken[] = [
  { name: 'xs', token: 'discord-xs', value: '6px' },
  { name: 'sm', token: 'discord-sm', value: '12px' },
  { name: 'md', token: 'discord-md', value: '14px' },
  { name: 'lg', token: 'discord-lg', value: '16px' },
  { name: 'xl', token: 'discord-xl', value: '40px' },
  { name: 'pill', token: 'discord-pill', value: '50px' },
  { name: 'jumbo', token: 'discord-jumbo', value: '120px' },
];
