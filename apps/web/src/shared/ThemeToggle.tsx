import { Button } from '@repo/ui/components/button';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useUiStore } from './ui-store';

export function ThemeToggle() {
  const isDark = useUiStore((state) => state.theme === 'dark');
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
