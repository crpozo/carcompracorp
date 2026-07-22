'use client';

import Avatar from './Avatar';

export default function Topbar({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => void;
}) {
  return (
    <div className="topbar">
      <div className="brand-sm">CarCompra</div>
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
