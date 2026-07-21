// Envio de notificaciones al vendedor via WhatsApp Cloud API (Graph API).

/**
 * Notifica al vendedor asignado con una plantilla de WhatsApp.
 * @param {object} args
 * @param {string} args.token         WHATSAPP_TOKEN (Bearer)
 * @param {string} args.phoneNumberId PHONE_NUMBER_ID emisor
 * @param {string} args.apiVersion    version de Graph API, p.ej. v21.0
 * @param {string} args.templateName  nombre de la plantilla, p.ej. nuevo_lead
 * @param {string} args.templateLang  codigo de idioma, p.ej. es
 * @param {object} args.vendedor      vendedor destino (usa .telefono)
 * @param {object} args.lead          lead a comunicar
 */
export async function notifyVendedor({
  token,
  phoneNumberId,
  apiVersion,
  templateName,
  templateLang,
  vendedor,
  lead,
}) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // Parametros del body EN ORDEN: nombre, telefono, anuncioOrigen (o 'Pauta').
  const body = {
    messaging_product: 'whatsapp',
    to: vendedor.telefono,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: lead.nombre },
            { type: 'text', text: lead.telefono },
            { type: 'text', text: lead.anuncioOrigen || 'Pauta' },
          ],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Incluir el cuerpo de la respuesta en el error para diagnostico en CloudWatch.
    const errText = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${errText}`);
  }

  return res.json();
}

/**
 * Envia un texto libre al destinatario (requiere ventana de 24 h abierta).
 * Lanza Error con el cuerpo de la respuesta si Meta lo rechaza.
 */
export async function enviarTexto({ token, phoneNumberId, apiVersion, to, texto }) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto, preview_url: false },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${errText}`);
  }
  return res.json();
}

/**
 * Reenvio del mensaje del cliente via plantilla `nuevo_mensaje` (para cuando
 * la ventana de 24 h con el vendedor esta cerrada). Params: nombre, texto.
 */
export async function enviarPlantillaNuevoMensaje({
  token,
  phoneNumberId,
  apiVersion,
  to,
  nombre,
  texto,
}) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'nuevo_mensaje',
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: nombre },
              { type: 'text', text: texto },
            ],
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${errText}`);
  }
  return res.json();
}
