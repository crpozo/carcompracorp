'use client';

import type { Lead, Vendedor } from '../lib/api';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';

function formatFechaLarga(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeadDrawer({
  lead,
  vendedores,
  onClose,
}: {
  lead: Lead | null;
  vendedores: Vendedor[];
  onClose: () => void;
}) {
  if (!lead) return null;

  const vendedor = lead.vendedorId
    ? vendedores.find((v) => v.vendedorId === lead.vendedorId)?.nombre ??
      lead.vendedorId
    : '';
  const digits = (lead.telefono || '').replace(/\D/g, '');

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Detalle del lead">
        <button className="drawer-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>

        <div className="drawer-head">
          <Avatar name={lead.nombre || '?'} size="sm" />
          <div>
            <div className="drawer-name">{lead.nombre || 'Sin nombre'}</div>
            <div className="sub">+{digits}</div>
          </div>
        </div>

        {digits && (
          <div className="lead-actions">
            <a
              className="btn wa"
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 Escribir por WhatsApp
            </a>
            <a className="btn" href={`tel:+${digits}`}>
              📞 Llamar
            </a>
          </div>
        )}

        <div className="drawer-field">
          <div className="f-label">Mensaje inicial</div>
          <p className="f-msg">{lead.mensaje || '—'}</p>
        </div>

        {lead.ultimoMensaje && lead.ultimoMensaje !== lead.mensaje && (
          <div className="drawer-field">
            <div className="f-label">
              Último mensaje{' '}
              {lead.ultimoMensajeEn
                ? `· ${formatFechaLarga(lead.ultimoMensajeEn)}`
                : ''}
            </div>
            <p className="f-msg">{lead.ultimoMensaje}</p>
          </div>
        )}

        <div className="drawer-field">
          <div className="f-label">Anuncio de origen</div>
          <div className="f-value">{lead.anuncioOrigen || '— (mensaje directo)'}</div>
        </div>

        <div className="drawer-field">
          <div className="f-label">Vendedor asignado</div>
          {vendedor ? (
            <div className="owner">
              <Avatar name={vendedor} /> {vendedor}
            </div>
          ) : (
            <div className="f-value sub">Sin asignar</div>
          )}
        </div>

        <div className="drawer-field">
          <div className="f-label">Recibido</div>
          <div className="f-value">{formatFechaLarga(lead.creadoEn)}</div>
        </div>

        <div className="drawer-field">
          <div className="f-label">Estado</div>
          <StatusBadge estado={lead.estado} />
        </div>
      </aside>
    </>
  );
}
