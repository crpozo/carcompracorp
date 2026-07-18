'use client';

// Compact page list: always show first/last, current ±1, and ellipsis gaps.
function pageList(total: number, current: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('…');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

export default function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="pager">
      <button
        className="nav"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        ‹ Anterior
      </button>
      {pageList(totalPages, page).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} style={{ color: 'var(--ink3)' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            className={p === page ? 'active' : ''}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="nav"
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente ›
      </button>
    </div>
  );
}
