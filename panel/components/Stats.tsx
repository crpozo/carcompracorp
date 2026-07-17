'use client';

import type { Stats as StatsType, Vendedor } from '../lib/api';

export default function Stats({
  stats,
  vendedores,
}: {
  stats: StatsType | null;
  vendedores: Vendedor[];
}) {
  if (!stats) {
    return <div className="msg">Cargando métricas…</div>;
  }

  const nameFor = (id: string) =>
    vendedores.find((v) => v.vendedorId === id)?.nombre ?? id;

  // Sort per-vendedor counts descending so the busiest sellers surface first.
  const porVendedor = [...stats.porVendedor].sort((a, b) => b.total - a.total);

  return (
    <div className="stats-grid">
      <div className="stat-card total">
        <div className="label">Total de leads</div>
        <div className="value">{stats.total}</div>
      </div>
      {porVendedor.map((v) => (
        <div className="stat-card" key={v.vendedorId}>
          <div className="label">{nameFor(v.vendedorId)}</div>
          <div className="value">{v.total}</div>
        </div>
      ))}
    </div>
  );
}
