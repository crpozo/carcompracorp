'use client';

import { useEffect, useRef, useState } from 'react';
import { eliminarLead, type Lead, type MensajeHistorial, type Vendedor } from '../lib/api';
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

// Hilo completo de la conversación. Los leads nuevos traen `historial`; para
// los anteriores al cambio se reconstruye con mensaje inicial + ultimoMensaje.
// Entradas sin `de` (guardadas antes del campo) se asumen del cliente.
function construirHilo(lead: Lead): MensajeHistorial[] {
  const out: MensajeHistorial[] = [];
  if (lead.historial?.length) {
    const primero = lead.historial[0];
    const inicialYaIncluido =
      primero && primero.texto === lead.mensaje;
    if (lead.mensaje && !inicialYaIncluido) {
      out.push({ de: 'cliente', texto: lead.mensaje, en: lead.creadoEn });
    }
    for (const h of lead.historial) {
      out.push({ ...h, de: h.de ?? 'cliente' });
    }
    return out;
  }
  if (lead.mensaje) out.push({ de: 'cliente', texto: lead.mensaje, en: lead.creadoEn });
  if (lead.ultimoMensaje && lead.ultimoMensaje !== lead.mensaje) {
    out.push({
      de: 'cliente',
      texto: lead.ultimoMensaje,
      en: lead.ultimoMensajeEn ?? '',
    });
  }
  return out.length ? out : [{ de: 'cliente', texto: '—', en: lead.creadoEn }];
}

export default function LeadDrawer({
  lead,
  vendedores,
  onClose,
  onDeleted,
}: {
  lead: Lead | null;
  vendedores: Vendedor[];
  onClose: () => void;
  onDeleted: (leadId: string) => void;
}) {
  const [hilo, setHilo] = useState<MensajeHistorial[]>([]);
  const [estado, setEstado] = useState<string>('');
  const [borrando, setBorrando] = useState(false);
  const [errorDel, setErrorDel] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Reset del estado local cuando cambia el lead abierto.
  useEffect(() => {
    if (lead) {
      setHilo(construirHilo(lead));
      setEstado(lead.estado ?? 'nuevo');
      setBorrando(false);
      setErrorDel(null);
    }
  }, [lead]);

  // Autoscroll al final del hilo al abrir o al agregar mensajes.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hilo]);

  if (!lead) return null;

  const vendedor = lead.vendedorId
    ? vendedores.find((v) => v.vendedorId === lead.vendedorId)?.nombre ??
      lead.vendedorId
    : '';
  const digits = (lead.telefono || '').replace(/\D/g, '');
  // Saludo pre-escrito: al abrir el chat, el vendedor ya tiene el mensaje listo.
  const primerNombre = (lead.nombre || '').trim().split(/\s+/)[0] || '';
  const saludo = encodeURIComponent(
    `Hola${primerNombre ? ` ${primerNombre}` : ''}, le saluda KING PEARL. ` +
      'Recibimos su consulta y con gusto le ayudamos.'
  );

  const borrar = async () => {
    if (borrando) return;
    const ok = window.confirm(
      `¿Eliminar el lead de "${lead.nombre || lead.telefono}"?\n\n` +
        'Esta acción no se puede deshacer.'
    );
    if (!ok) return;
    setBorrando(true);
    setErrorDel(null);
    try {
      await eliminarLead(lead.leadId);
      onDeleted(lead.leadId);
      onClose();
    } catch (e) {
      setErrorDel(e instanceof Error ? e.message : 'No se pudo eliminar.');
      setBorrando(false);
    }
  };

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
          <div className="f-label">Conversación ({hilo.length})</div>
          <div className="msg-thread" ref={threadRef}>
            {hilo.map((m, i) => (
              <div
                className={`bubble-row ${m.de === 'vendedor' ? 'mine' : ''}`}
                key={`${m.en}-${i}`}
              >
                <div className={`bubble ${m.de === 'vendedor' ? 'mine' : ''}`}>
                  <p>{m.texto || '—'}</p>
                  <div className="bubble-meta">
                    {m.de === 'vendedor' ? `${m.por || 'panel'} · ` : ''}
                    {formatHora(m.en)}
                  </div>
                </div>
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
          <StatusBadge estado={estado || lead.estado} />
        </div>

        <div className="drawer-danger">
          {errorDel && <div className="composer-error">{errorDel}</div>}
          <button
            type="button"
            className="btn-danger"
            onClick={borrar}
            disabled={borrando}
          >
            {borrando ? 'Eliminando…' : '🗑 Eliminar lead'}
          </button>
        </div>
      </aside>
    </>
  );
}
