'use client';

import type { Lead, Vendedor } from '../lib/api';

const ESTADOS = new Set([
  'nuevo',
  'contactado',
  'interesado',
  'cerrado',
  'perdido',
]);

function formatFecha(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
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
    id ? vendedores.find((v) => v.vendedorId === id)?.nombre ?? id : '—';

  if (leads.length === 0) {
    return (
      <div className="table-wrap">
        <div className="msg">No hay leads para mostrar.</div>
      </div>
    );
  }

  return (
    <>
      <p className="count-note">
        {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
      </p>
      <div className="table-wrap">
        <table className="leads">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Anuncio</th>
              <th>Vendedor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const estado = (lead.estado ?? '').toLowerCase();
              const badgeClass = ESTADOS.has(estado) ? estado : 'unknown';
              return (
                <tr key={lead.leadId}>
                  <td className="cell-muted">{formatFecha(lead.creadoEn)}</td>
                  <td className="cell-strong">{lead.nombre || '—'}</td>
                  <td>{lead.telefono || '—'}</td>
                  <td>{lead.anuncioOrigen || '—'}</td>
                  <td>{nameFor(lead.vendedorId)}</td>
                  <td>
                    <span className={`badge ${badgeClass}`}>
                      {lead.estado || '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
