// Handler principal del webhook de WhatsApp (API Gateway HTTP API, payload v2.0).
// Verifica el webhook (GET), procesa mensajes entrantes (POST), deduplica por
// wamid, asigna vendedor round-robin y notifica via WhatsApp Cloud API.
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getSecrets } from './lib/secrets.mjs';
import { ddb, saveLeadIfNew, leadActivoPorTelefono } from './lib/dynamo.mjs';
import { buildLead } from './lib/parse.mjs';
import { assignVendedor } from './lib/roundrobin.mjs';
import { notifyVendedor } from './lib/whatsapp.mjs';

const LEADS_TABLE = process.env.LEADS_TABLE;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'nuevo_lead';
const TEMPLATE_LANG = process.env.TEMPLATE_LANG || 'es';

// Remitentes del sistema de Meta (avisos de setup, etc.) que NUNCA son leads.
const REMITENTES_IGNORADOS = new Set(['16465894168']);

export async function handler(event) {
  const method = event?.requestContext?.http?.method;

  // --- Verificacion del webhook de Meta (handshake GET) ---
  if (method === 'GET') {
    return handleVerification(event);
  }

  // --- Recepcion de mensajes (POST) ---
  if (method === 'POST') {
    return handleIncoming(event);
  }

  // Cualquier otro metodo: responder 200 para evitar reintentos de WhatsApp.
  return { statusCode: 200, body: 'ok' };
}

/**
 * GET: Meta valida el webhook enviando hub.mode/hub.verify_token/hub.challenge.
 */
async function handleVerification(event) {
  const qs = event.queryStringParameters || {};
  const mode = qs['hub.mode'];
  const token = qs['hub.verify_token'];
  const challenge = qs['hub.challenge'];

  const { VERIFY_TOKEN } = await getSecrets();

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    // Meta espera el challenge en texto plano.
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: challenge != null ? String(challenge) : '',
    };
  }

  return { statusCode: 403, body: 'Forbidden' };
}

/**
 * POST: procesa el batch de mensajes. Siempre devuelve 200 al final.
 */
async function handleIncoming(event) {
  // Parseo defensivo del body (puede venir en base64).
  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';
    body = JSON.parse(raw);
  } catch (err) {
    console.error('No se pudo parsear el body del webhook:', err.message);
    return { statusCode: 200, body: 'ok' };
  }

  // Navegacion segura hasta value.
  const value = body?.entry?.[0]?.changes?.[0]?.value;

  // Statuses de entrega de mensajes salientes: registrar fallos para poder
  // diagnosticar notificaciones que la API acepta pero nunca llegan.
  if (value && Array.isArray(value.statuses)) {
    for (const st of value.statuses) {
      if (st.status === 'failed' || st.errors) {
        console.error('Entrega FALLIDA de mensaje saliente', {
          to: st.recipient_id,
          status: st.status,
          errors: JSON.stringify(st.errors || []),
        });
      } else {
        console.log('Status de entrega', { to: st.recipient_id, status: st.status });
      }
    }
  }

  // Si no hay mensajes (p.ej. eran solo statuses) no hay nada mas que hacer.
  if (!value || !Array.isArray(value.messages) || value.messages.length === 0) {
    return { statusCode: 200, body: 'ok' };
  }

  const nowIso = new Date().toISOString();

  // Procesar cada mensaje aislado: un fallo individual nunca impide el 200 final.
  for (const msg of value.messages) {
    if (msg?.from && REMITENTES_IGNORADOS.has(msg.from)) {
      console.log('Mensaje de sistema de Meta ignorado', { from: msg.from, id: msg.id });
      continue;
    }
    try {
      await procesarMensaje(value, msg, nowIso);
    } catch (err) {
      console.error('Error procesando mensaje', msg?.id, err.message);
    }
  }

  return { statusCode: 200, body: 'ok' };
}

/**
 * Flujo por mensaje: construir lead -> dedupe -> asignar vendedor -> notificar.
 */
async function procesarMensaje(value, msg, nowIso) {
  const lead = buildLead(value, msg, nowIso);

  // Un cliente = un caso: si el telefono ya tiene un lead activo (no cerrado/
  // perdido), este mensaje se acumula ahi — sin lead nuevo, sin reasignar y
  // sin volver a notificar.
  const existente = await leadActivoPorTelefono(lead.telefono);
  if (existente) {
    // Acumular en el historial del caso (lista append-only de {texto, en}).
    await ddb.send(new UpdateCommand({
      TableName: LEADS_TABLE,
      Key: { leadId: existente.leadId },
      UpdateExpression:
        'SET ultimoMensaje = :m, ultimoMensajeEn = :t, ' +
        'historial = list_append(if_not_exists(historial, :vacio), :nuevo)',
      ExpressionAttributeValues: {
        ':m': lead.mensaje || '',
        ':t': nowIso,
        ':vacio': [],
        ':nuevo': [{ texto: lead.mensaje || '', en: nowIso }],
      },
    }));
    console.log('Mensaje adicional acumulado en caso existente', {
      leadId: existente.leadId,
      telefono: lead.telefono,
    });
    return;
  }

  // Lead nuevo: el historial arranca con el mensaje inicial.
  lead.historial = [{ texto: lead.mensaje || '', en: lead.creadoEn }];

  // Dedupe por wamid: si ya existia, WhatsApp reintento; no reprocesar.
  const esNuevo = await saveLeadIfNew(lead);
  if (!esNuevo) {
    console.log('Lead duplicado, se ignora', { leadId: lead.leadId });
    return;
  }

  console.log('Lead nuevo guardado', {
    leadId: lead.leadId,
    telefono: lead.telefono,
    anuncioOrigen: lead.anuncioOrigen,
  });

  // Asignacion round-robin de vendedor.
  const vendedor = await assignVendedor();
  if (!vendedor) {
    console.log('Sin vendedores activos, lead queda sin asignar', { leadId: lead.leadId });
    return;
  }

  // Persistir el vendedorId en el item del lead.
  await ddb.send(new UpdateCommand({
    TableName: LEADS_TABLE,
    Key: { leadId: lead.leadId },
    UpdateExpression: 'SET vendedorId = :v',
    ExpressionAttributeValues: { ':v': vendedor.vendedorId },
  }));

  console.log('Vendedor asignado', {
    leadId: lead.leadId,
    vendedorId: vendedor.vendedorId,
  });

  // Notificar al vendedor. El fallo de notificacion nunca bloquea el 200.
  try {
    const { WHATSAPP_TOKEN, PHONE_NUMBER_ID } = await getSecrets();
    await notifyVendedor({
      token: WHATSAPP_TOKEN,
      phoneNumberId: PHONE_NUMBER_ID,
      apiVersion: GRAPH_API_VERSION,
      templateName: TEMPLATE_NAME,
      templateLang: TEMPLATE_LANG,
      vendedor,
      lead,
    });
    console.log('Notificacion enviada al vendedor', {
      leadId: lead.leadId,
      vendedorId: vendedor.vendedorId,
    });
  } catch (err) {
    console.error('Fallo al notificar al vendedor', {
      leadId: lead.leadId,
      vendedorId: vendedor.vendedorId,
      error: err.message,
    });
  }
}
