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

function formatHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Hilo completo del cliente. Los leads nuevos traen `historial`; para los
// anteriores al cambio se reconstruye con mensaje inicial + ultimoMensaje.
function historial(lead: Lead): { texto: string; en: string }[] {
  const out: { texto: string; en: string }[] = [];
  if (lead.mensaje) out.push({ texto: lead.mensaje, en: lead.creadoEn });
  for (const h of lead.historial ?? []) {
    if (out.length === 1 && h.texto === lead.mensaje && h.en === lead.creadoEn)
      continue; // el inicial ya está
    out.push(h);
  }
  if (
    !lead.historial?.length &&
    lead.ultimoMensaje &&
    lead.ultimoMensaje !== lead.mensaje
  ) {
    out.push({ texto: lead.ultimoMensaje, en: lead.ultimoMensajeEn ?? '' });
  }
  return out.length ? out : [{ texto: '—', en: lead.creadoEn }];
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
  // Saludo pre-escrito: al abrir el chat, el vendedor ya tiene el mensaje listo.
  const primerNombre = (lead.nombre || '').trim().split(/\s+/)[0] || '';
  const saludo = encodeURIComponent(
    `Hola${primerNombre ? ` ${primerNombre}` : ''}, le saluda CarCompra 🚗. ` +
      'Recibimos su consulta y con gusto le ayudamos.'
  );

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
              href={`https://wa.me/${digits}?text=${saludo}`}
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
          <div className="f-label">
            Historial de mensajes ({historial(lead).length})
          </div>
          <div className="msg-thread">
            {historial(lead).map((m, i) => (
              <div className="msg-item" key={`${m.en}-${i}`}>
                <p className="f-msg">{m.texto || '—'}</p>
                <div className="msg-time">{formatHora(m.en)}</div>
              </div>
            ))}
          </div>
        </div>

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
