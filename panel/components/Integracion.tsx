'use client';

import { useState } from 'react';

// Datos de configuración del sistema (públicos: URLs e identificadores, sin
// secretos). El estado en vivo se consulta en CloudWatch / Meta, no aquí.
const WEBHOOK_URL =
  'https://k9qa5m38de.execute-api.us-east-1.amazonaws.com/webhook';
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard no disponible */
    }
  };
  return (
    <button className="btn copy-btn" onClick={copy}>
      {copied ? 'Copiado ✓' : 'Copiar'}
    </button>
  );
}

const ITEMS: {
  icon: string;
  title: string;
  sub: string;
  chip: string;
  copy?: string;
}[] = [
  {
    icon: '💬',
    title: 'WhatsApp Business (Meta Cloud API)',
    sub: '+593 98 523 8661 · cuenta "KingPearl"',
    chip: 'Configurado',
  },
  {
    icon: '📥',
    title: 'Webhook de entrada de leads',
    sub: WEBHOOK_URL,
    chip: 'Configurado',
    copy: WEBHOOK_URL,
  },
  {
    icon: '🔔',
    title: 'Notificación al vendedor',
    sub: 'Plantilla de WhatsApp "nuevo_lead" (español) — se envía al asignar cada lead',
    chip: 'Configurado',
  },
  {
    icon: '🗄️',
    title: 'Base de datos (AWS DynamoDB)',
    sub: 'Tablas carcompra-leads / carcompra-vendedores · región us-east-1',
    chip: 'Configurado',
  },
  {
    icon: '🔌',
    title: 'API del panel (solo lectura)',
    sub: API_URL || '—',
    chip: 'Configurado',
    copy: API_URL || undefined,
  },
];

export default function Integracion() {
  return (
    <div className="int-wrap">
      {ITEMS.map((it) => (
        <div className="int-card" key={it.title}>
          <div className="int-ic">{it.icon}</div>
          <div className="int-body">
            <div className="int-title">
              {it.title} <span className="int-chip">{it.chip}</span>
            </div>
            <div className="int-sub">{it.sub}</div>
          </div>
          {it.copy ? <CopyButton text={it.copy} /> : null}
        </div>
      ))}
      <p className="int-note">
        Esta vista muestra la configuración del sistema (sin secretos). Flujo:
        pauta click-to-WhatsApp → WhatsApp → webhook (AWS) → asignación
        round-robin → notificación al vendedor → este panel.
      </p>
    </div>
  );
}
