'use client';

const LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  interesado: 'Interesado',
  cerrado: 'Cerrado',
  perdido: 'Perdido',
};

export default function StatusBadge({ estado }: { estado?: string }) {
  const e = (estado ?? '').toLowerCase();
  const cls = LABELS[e] ? e : 'unknown';
  const label = LABELS[e] ?? (estado || '—');
  return (
    <span className={`badge-estado e-${cls}`}>
      <span className="dot" />
      {label}
    </span>
  );
}
