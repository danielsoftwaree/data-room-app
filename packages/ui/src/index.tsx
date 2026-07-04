/**
 * Shared design-system primitives.
 * Deliberately unaware of dataroom business logic.
 * Styling is minimal inline for now; will move to Tailwind + shadcn/ui tokens
 * (see @repo/tailwind-config) when Tailwind lands in apps/web.
 */
import type { CSSProperties, ReactNode } from 'react';

const buttonBase: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
  border: '1px solid transparent',
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const styles: CSSProperties =
    variant === 'primary'
      ? { ...buttonBase, background: '#2563eb', color: '#fff' }
      : { ...buttonBase, background: 'transparent', color: '#1f2937', borderColor: '#d1d5db' };
  return (
    <button
      type="button"
      style={{ ...styles, opacity: disabled ? 0.5 : 1 }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '48px 24px',
        border: '1px dashed #d1d5db',
        borderRadius: 12,
        color: '#374151',
        textAlign: 'center',
      }}
    >
      <strong style={{ fontSize: 16 }}>{title}</strong>
      {description ? <span style={{ fontSize: 14, color: '#6b7280' }}>{description}</span> : null}
      {action}
    </div>
  );
}
