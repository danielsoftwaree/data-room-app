import { Button } from '@repo/ui/components/button';
import { MoonIcon, SunIcon } from 'lucide-react';
import { setDarkTheme, useDarkTheme } from './theme';

export function ThemeToggle() {
  const isDark = useDarkTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setDarkTheme(!isDark)}
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
