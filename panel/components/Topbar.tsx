'use client';

import Avatar from './Avatar';

export default function Topbar({
  query,
  onQuery,
  email,
  onSignOut,
}: {
  query: string;
  onQuery: (v: string) => void;
  email: string;
  onSignOut: () => void;
}) {
  return (
    <div className="topbar">
      <div className="brand-sm">
        <span className="logo">🚗</span> CarCompra
      </div>
      <div className="search">
        <span className="si">🔍</span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar lead por nombre, teléfono o anuncio…"
        />
      </div>
      <div className="top-actions">
        <div className="userchip">
          <Avatar name={email || 'U'} size="sm" />
          <span className="email">{email || 'Supervisor'}</span>
        </div>
        <span className="divider" />
        <button className="linkbtn" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
