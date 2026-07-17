import {
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, LEADS_TABLE, VENDEDORES_TABLE } from './lib/dynamo.mjs';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const CORS_HEADERS = {
  'content-type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
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

    return jsonResponse(404, { message: 'Not found' });
  } catch (err) {
    // Log the real error for CloudWatch; return a safe generic message.
    console.error('API handler error:', err);
    return jsonResponse(500, { message: 'Internal server error' });
  }
}
