'use client';

import type { Stats, Vendedor } from '../lib/api';
import Avatar from './Avatar';

export default function VendedoresTable({
  vendedores,
  stats,
}: {
  vendedores: Vendedor[];
  stats: Stats | null;
}) {
  const countFor = (id: string) =>
    stats?.porVendedor.find((v) => v.vendedorId === id)?.total ?? 0;

  if (vendedores.length === 0) {
    return <div className="msg">No hay vendedores cargados.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="leads">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Teléfono</th>
            <th>Estado</th>
            <th>Leads asignados</th>
          </tr>
        </thead>
        <tbody>
          {[...vendedores]
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            .map((v) => (
              <tr key={v.vendedorId}>
                <td>
                  <div className="cell-main">
                    <Avatar name={v.nombre} />
                    <div className="nm">{v.nombre}</div>
                  </div>
                </td>
                <td>{v.telefono || '—'}</td>
                <td>
                  <span
                    className={`badge-estado ${
                      v.activo === false ? 'e-perdido' : 'e-interesado'
                    }`}
                  >
                    <span className="dot" />
                    {v.activo === false ? 'Inactivo' : 'Activo'}
                  </span>
                </td>
                <td className="nm">{countFor(v.vendedorId)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
