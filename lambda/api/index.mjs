import {
  ScanCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, LEADS_TABLE, VENDEDORES_TABLE } from './lib/dynamo.mjs';
import { getSecrets } from './lib/secrets.mjs';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
// Ventana de servicio de WhatsApp: 24 h desde el último mensaje del cliente.
const VENTANA_MS = 24 * 60 * 60 * 1000;

const CORS_HEADERS = {
  'content-type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function encodeCursor(key) {
  if (!key) return null;
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) return undefined;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') return parsed;
    return undefined;
  } catch {
    // Malformed cursor -> treat as no cursor rather than 500.
    return undefined;
  }
}

function parseLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function getLeads(query) {
  const limit = parseLimit(query.limit);
  const exclusiveStartKey = decodeCursor(query.cursor);
  const vendedorId = query.vendedorId;

  let result;
  if (vendedorId) {
    result = await ddb.send(
      new QueryCommand({
        TableName: LEADS_TABLE,
        IndexName: 'gsi-vendedor',
        KeyConditionExpression: 'vendedorId = :v',
        ExpressionAttributeValues: { ':v': vendedorId },
        ScanIndexForward: false, // newest first (SK = creadoEn)
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
  } else {
    result = await ddb.send(
      new ScanCommand({
        TableName: LEADS_TABLE,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
  }

  return jsonResponse(200, {
    items: result.Items || [],
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  });
}

async function getVendedores() {
  const items = await scanAll(VENDEDORES_TABLE);
  items.sort((a, b) => {
    const oa = typeof a.orden === 'number' ? a.orden : Number.POSITIVE_INFINITY;
    const ob = typeof b.orden === 'number' ? b.orden : Number.POSITIVE_INFINITY;
    return oa - ob;
  });
  return jsonResponse(200, { items });
}

async function getStats() {
  const leads = await scanAll(LEADS_TABLE);

  const porVendedor = {};
  const porEstado = {};
  for (const lead of leads) {
    if (lead.vendedorId) {
      porVendedor[lead.vendedorId] = (porVendedor[lead.vendedorId] || 0) + 1;
    }
    if (lead.estado) {
      porEstado[lead.estado] = (porEstado[lead.estado] || 0) + 1;
    }
  }

  // Cheap join: fetch vendedores once and map ids -> names.
  const vendedores = await scanAll(VENDEDORES_TABLE);
  const nombresVendedor = {};
  for (const v of vendedores) {
    nombresVendedor[v.vendedorId] = v.nombre;
  }

  return jsonResponse(200, {
    totalLeads: leads.length,
    porVendedor,
    porEstado,
    nombresVendedor,
  });
}

/**
 * POST /responder — el vendedor/supervisor responde al cliente desde el panel.
 * El mensaje sale por el número del negocio (Cloud API, texto libre dentro de
 * la ventana de 24 h) y se registra en el historial del lead.
 */
async function responder(event) {
  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { message: 'JSON inválido' });
  }

  const leadId = body?.leadId;
  const texto = String(body?.texto || '').trim();
  if (!leadId || !texto) {
    return jsonResponse(400, { message: 'leadId y texto son requeridos' });
  }
  if (texto.length > 3000) {
    return jsonResponse(400, { message: 'El mensaje es demasiado largo' });
  }

  const res = await ddb.send(
    new GetCommand({ TableName: LEADS_TABLE, Key: { leadId } }),
  );
  const lead = res.Item;
  if (!lead || !lead.telefono) {
    return jsonResponse(404, { message: 'Lead no encontrado' });
  }

  // Ventana de 24 h: si el cliente no escribe hace más de un día, WhatsApp no
  // permite texto libre (solo plantillas). Avisar claro al panel.
  const ultimoCliente = lead.ultimoMensajeEn || lead.creadoEn;
  const ventanaCerrada =
    !ultimoCliente ||
    Date.now() - new Date(ultimoCliente).getTime() > VENTANA_MS;
  if (ventanaCerrada) {
    return jsonResponse(409, {
      code: 'ventana_cerrada',
      message:
        'La ventana de 24 h de WhatsApp está cerrada (el cliente no escribe ' +
        'hace más de un día). Contáctalo con el botón verde de WhatsApp.',
    });
  }

  const { WHATSAPP_TOKEN, PHONE_NUMBER_ID } = await getSecrets();
  const resp = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: lead.telefono,
        type: 'text',
        text: { body: texto, preview_url: false },
      }),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    console.error('Fallo al enviar respuesta por WhatsApp:', detail);
    if (detail.includes('131047')) {
      return jsonResponse(409, {
        code: 'ventana_cerrada',
        message:
          'WhatsApp cerró la ventana de 24 h de este cliente. Contáctalo con ' +
          'el botón verde de WhatsApp.',
      });
    }
    return jsonResponse(502, { message: 'WhatsApp rechazó el envío' });
  }

  // Registrar en el historial (reconstruyendo la base en leads antiguos).
  const en = new Date().toISOString();
  const por =
    event?.requestContext?.authorizer?.jwt?.claims?.email || 'panel';
  const entrada = { de: 'vendedor', texto, en, por };
  const base = lead.historial ?? [
    { de: 'cliente', texto: lead.mensaje || '', en: lead.creadoEn },
    ...(lead.ultimoMensaje && lead.ultimoMensaje !== lead.mensaje
      ? [{ de: 'cliente', texto: lead.ultimoMensaje, en: lead.ultimoMensajeEn || lead.creadoEn }]
      : []),
  ];
  // Primer contacto del vendedor: el estado pasa de "nuevo" a "contactado".
  const nuevoEstado = (lead.estado || 'nuevo') === 'nuevo' ? 'contactado' : lead.estado;
  await ddb.send(
    new UpdateCommand({
      TableName: LEADS_TABLE,
      Key: { leadId },
      UpdateExpression: 'SET historial = :h, estado = :e',
      ExpressionAttributeValues: { ':h': [...base, entrada], ':e': nuevoEstado },
    }),
  );

  return jsonResponse(200, { ok: true, entrada, estado: nuevoEstado });
}

/**
 * POST /eliminar — borra un lead por leadId (limpieza de tests/spam).
 */
async function eliminar(event) {
  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { message: 'JSON inválido' });
  }

  const leadId = body?.leadId;
  if (!leadId) {
    return jsonResponse(400, { message: 'leadId es requerido' });
  }

  await ddb.send(
    new DeleteCommand({ TableName: LEADS_TABLE, Key: { leadId } }),
  );
  const quien =
    event?.requestContext?.authorizer?.jwt?.claims?.email || 'panel';
  console.log('Lead eliminado desde el panel', { leadId, por: quien });
  return jsonResponse(200, { ok: true });
}

// Paginate through an entire table, accumulating all items.
async function scanAll(tableName) {
  const items = [];
  let exclusiveStartKey;
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    if (result.Items) items.push(...result.Items);
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

// ---------------------------------------------------------------------------
// Handler (HTTP API payload format 2.0)
// ---------------------------------------------------------------------------

export async function handler(event) {
  const method =
    event?.requestContext?.http?.method || 'GET';
  const rawPath = event?.rawPath || '/';
  // Normalize trailing slash (except root).
  const path =
    rawPath.length > 1 && rawPath.endsWith('/')
      ? rawPath.slice(0, -1)
      : rawPath;
  const query = event?.queryStringParameters || {};

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    if (method === 'GET') {
      switch (path) {
        case '/leads':
          return await getLeads(query);
        case '/vendedores':
          return await getVendedores();
        case '/stats':
          return await getStats();
        default:
          break;
      }
    }

    if (method === 'POST' && path === '/responder') {
      return await responder(event);
    }

    if (method === 'POST' && path === '/eliminar') {
      return await eliminar(event);
    }

    return jsonResponse(404, { message: 'Not found' });
  } catch (err) {
    // Log the real error for CloudWatch; return a safe generic message.
    console.error('API handler error:', err);
    return jsonResponse(500, { message: 'Internal server error' });
  }
}
