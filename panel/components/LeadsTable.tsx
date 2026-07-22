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
  unreadIds,
  onSelect,
  onVendorFilter,
}: {
  leads: Lead[];
  vendedores: Vendedor[];
  unreadIds: Set<string>;
  onSelect: (lead: Lead) => void;
  onVendorFilter: (vendedorId: string) => void;
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
            const unread = unreadIds.has(lead.leadId);
            return (
              <tr
                key={lead.leadId}
                className={`row-click${unread ? ' row-unread' : ''}`}
                onClick={() => onSelect(lead)}
                title="Ver detalle del lead"
              >
                <td>
                  <div className="cell-main">
                    <span className="avatar-wrap">
                      <Avatar name={lead.nombre || '?'} />
                      {unread && <span className="unread-dot" title="Mensaje sin leer" />}
                    </span>
                    <div>
                      <div className="nm">{lead.nombre || 'Sin nombre'}</div>
                      <div className="sub">{lead.telefono || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="anuncio">{lead.anuncioOrigen || '—'}</td>
                <td>
                  <div
                    className="msg-cell"
                    title={lead.ultimoMensaje || lead.mensaje || ''}
                  >
                    {lead.ultimoMensaje || lead.mensaje || '—'}
                  </div>
                </td>
                <td>
                  {vendedor ? (
                    <button
                      type="button"
                      className="owner owner-btn"
                      title={`Filtrar por ${vendedor}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (lead.vendedorId) onVendorFilter(lead.vendedorId);
                      }}
                    >
                      <Avatar name={vendedor} />
                      {vendedor}
                    </button>
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
