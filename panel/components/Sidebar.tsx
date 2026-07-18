'use client';

type View = 'leads' | 'vendedores';

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
        <button
          className={view === 'leads' ? 'active' : ''}
          onClick={() => onView('leads')}
        >
          <span className="ic">📇</span> Leads
        </button>
        <button
          className={view === 'vendedores' ? 'active' : ''}
          onClick={() => onView('vendedores')}
        >
          <span className="ic">👥</span> Vendedores
        </button>
        <button className="muted" type="button" disabled>
          <span className="ic">📊</span> Reportes <span className="soon">pronto</span>
        </button>
        <button className="muted" type="button" disabled>
          <span className="ic">🔗</span> Integración <span className="soon">pronto</span>
        </button>
      </nav>
      <div className="side-foot">
        <button className="muted" type="button" disabled>
          <span className="ic">⚙️</span> Ajustes
        </button>
        <button className="muted" type="button" disabled>
          <span className="ic">❔</span> Ayuda
        </button>
      </div>
    </aside>
  );
}
