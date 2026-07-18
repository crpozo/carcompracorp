'use client';

import type { Lead, Vendedor } from '../lib/api';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';

function formatFecha(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeadsTable({
  leads,
  vendedores,
}: {
  leads: Lead[];
  vendedores: Vendedor[];
}) {
  const nameFor = (id?: string) =>
    id ? vendedores.find((v) => v.vendedorId === id)?.nombre ?? id : '';

  if (leads.length === 0) {
    return <div className="msg">No hay leads para mostrar.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="leads">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Anuncio</th>
            <th>Mensaje</th>
            <th>Vendedor</th>
            <th>Recibido</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const vendedor = nameFor(lead.vendedorId);
            return (
              <tr key={lead.leadId}>
                <td>
                  <div className="cell-main">
                    <Avatar name={lead.nombre || '?'} />
                    <div>
                      <div className="nm">{lead.nombre || 'Sin nombre'}</div>
                      <div className="sub">{lead.telefono || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="anuncio">{lead.anuncioOrigen || '—'}</td>
                <td>
                  <div className="msg-cell" title={lead.mensaje || ''}>
                    {lead.mensaje || '—'}
                  </div>
                </td>
                <td>
                  {vendedor ? (
                    <div className="owner">
                      <Avatar name={vendedor} />
                      {vendedor}
                    </div>
                  ) : (
                    <span className="sub">Sin asignar</span>
                  )}
                </td>
                <td className="sub">{formatFecha(lead.creadoEn)}</td>
                <td>
                  <StatusBadge estado={lead.estado} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
