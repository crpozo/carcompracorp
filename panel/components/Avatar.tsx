'use client';

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f472b6', '#64748b',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(s: string): string {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export default function Avatar({
  name,
  size = 'xs',
}: {
  name: string;
  size?: 'xs' | 'sm';
}) {
  const label = name && name.trim() ? name : '?';
  const bg = PALETTE[hash(label) % PALETTE.length];
  return (
    <span className={`avatar ${size}`} style={{ background: bg }} aria-hidden>
      {initials(label)}
    </span>
  );
}
