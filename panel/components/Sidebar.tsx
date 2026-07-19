'use client';

export type View = 'leads' | 'vendedores' | 'reportes' | 'integracion';

const ITEMS: { key: View; icon: string; label: string }[] = [
  { key: 'leads', icon: '📇', label: 'Leads' },
  { key: 'vendedores', icon: '👥', label: 'Vendedores' },
  { key: 'reportes', icon: '📊', label: 'Reportes' },
  { key: 'integracion', icon: '🔗', label: 'Integración' },
];

export default function Sidebar({
  view,
  onView,
}: {
  view: View;
  onView: (v: View) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo">🚗</span> CarCompra
      </div>
      <nav className="nav">
        {ITEMS.map((it) => (
          <button
            key={it.key}
            className={view === it.key ? 'active' : ''}
            onClick={() => onView(it.key)}
          >
            <span className="ic">{it.icon}</span> {it.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
