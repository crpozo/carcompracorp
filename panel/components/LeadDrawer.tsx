'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  eliminarLead,
  responderLead,
  type Lead,
  type MensajeHistorial,
  type Vendedor,
} from '../lib/api';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';

function formatFecha(iso: string): string {
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

// Etiqueta de día para separar mensajes por fecha (hoy / ayer / fecha).
function diaLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, hoy)) return 'Hoy';
  if (same(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Hilo completo de la conversación. Los leads nuevos traen `historial`; para
// los anteriores al cambio se reconstruye con mensaje inicial + ultimoMensaje.
function construirHilo(lead: Lead): MensajeHistorial[] {
  const out: MensajeHistorial[] = [];
  if (lead.historial?.length) {
    const primero = lead.historial[0];
    const inicialYaIncluido = primero && primero.texto === lead.mensaje;
    if (lead.mensaje && !inicialYaIncluido) {
      out.push({ de: 'cliente', texto: lead.mensaje, en: lead.creadoEn });
    }
    for (const h of lead.historial) out.push({ ...h, de: h.de ?? 'cliente' });
    return out;
  }
  if (lead.mensaje) out.push({ de: 'cliente', texto: lead.mensaje, en: lead.creadoEn });
  if (lead.ultimoMensaje && lead.ultimoMensaje !== lead.mensaje) {
    out.push({ de: 'cliente', texto: lead.ultimoMensaje, en: lead.ultimoMensajeEn ?? '' });
  }
  return out.length ? out : [{ de: 'cliente', texto: '—', en: lead.creadoEn }];
}

export default function LeadDrawer({
  lead,
  vendedores,
  onClose,
  onDeleted,
  onReplied,
}: {
  lead: Lead | null;
  vendedores: Vendedor[];
  onClose: () => void;
  onDeleted: (leadId: string) => void;
  onReplied: (leadId: string, entrada: MensajeHistorial, estado: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorSend, setErrorSend] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorDel, setErrorDel] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const leadId = lead?.leadId;

  useEffect(() => {
    setTexto('');
    setErrorSend(null);
    setErrorDel(null);
    setBorrando(false);
  }, [leadId]);

  const hilo = useMemo(() => (lead ? construirHilo(lead) : []), [lead]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hilo.length, leadId]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lead, onClose]);

  if (!lead) return null;

  const vendedor = lead.vendedorId
    ? vendedores.find((v) => v.vendedorId === lead.vendedorId)?.nombre ??
      lead.vendedorId
    : '';
  const digits = (lead.telefono || '').replace(/\D/g, '');
  const estado = lead.estado || 'nuevo';
  const primerNombre = (lead.nombre || '').trim().split(/\s+/)[0] || '';
  const saludo = encodeURIComponent(
    `Hola${primerNombre ? ` ${primerNombre}` : ''}, le saluda KING PEARL. ` +
      'Recibimos su consulta y con gusto le ayudamos.'
  );

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErrorSend(null);
    try {
      const res = await responderLead(lead.leadId, t);
      onReplied(lead.leadId, res.entrada, res.estado);
      setTexto('');
    } catch (e) {
      setErrorSend(e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally {
      setEnviando(false);
    }
  };

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

  let ultimoDia = '';

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="chat-panel" role="dialog" aria-label="Conversación del lead">
        {/* Encabezado */}
        <header className="chat-top">
          <Avatar name={lead.nombre || '?'} size="sm" />
          <div className="chat-who">
            <div className="chat-name">{lead.nombre || 'Sin nombre'}</div>
            <div className="chat-sub">+{digits}</div>
          </div>
          <div className="chat-top-actions">
            {digits && (
              <>
                <a
                  className="btn wa sm"
                  href={`https://wa.me/${digits}?text=${saludo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir en tu WhatsApp personal (no se registra)"
                >
                  💬 WhatsApp
                </a>
                <a className="btn sm" href={`tel:+${digits}`} title="Llamar">
                  📞
                </a>
              </>
            )}
            <button className="drawer-close" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </header>

        {/* Barra de contexto */}
        <div className="chat-meta">
          <span>
            Vendedor: <strong>{vendedor || 'Sin asignar'}</strong>
          </span>
          <span className="dot-sep">·</span>
          <StatusBadge estado={estado} />
          {lead.anuncioOrigen && (
            <>
              <span className="dot-sep">·</span>
              <span>De: {lead.anuncioOrigen}</span>
            </>
          )}
        </div>

        {/* Conversación (ocupa todo el alto) */}
        <div className="chat-thread" ref={threadRef}>
          {hilo.map((m, i) => {
            const dia = diaLabel(m.en);
            const mostrarDia = dia && dia !== ultimoDia;
            if (mostrarDia) ultimoDia = dia;
            return (
              <div key={`${m.en}-${i}`}>
                {mostrarDia && <div className="chat-day">{dia}</div>}
                <div className={`bubble-row ${m.de === 'vendedor' ? 'mine' : ''}`}>
                  <div className={`bubble ${m.de === 'vendedor' ? 'mine' : ''}`}>
                    <p>{m.texto || '—'}</p>
                    <div className="bubble-meta">
                      {m.de === 'vendedor' ? `${m.por || 'panel'} · ` : ''}
                      {formatFecha(m.en)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="chat-foot">
          {errorSend && <div className="composer-error">{errorSend}</div>}
          <div className="composer">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Responder a ${primerNombre || 'cliente'} por WhatsApp…`}
              rows={1}
              disabled={enviando}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
            />
            <button
              className="btn dark"
              onClick={enviar}
              disabled={enviando || !texto.trim()}
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          <div className="chat-foot-row">
            <span className="composer-hint">
              Sale del número del negocio (KING PEARL) y queda en el historial.
              También puedes responder desde tu celular en el chat del negocio.
            </span>
            <button
              type="button"
              className="link-danger"
              onClick={borrar}
              disabled={borrando}
            >
              {borrando ? 'Eliminando…' : 'Eliminar lead'}
            </button>
          </div>
          {errorDel && <div className="composer-error">{errorDel}</div>}
        </div>
      </aside>
    </>
  );
}
