// Cliente DynamoDB (Document Client) y helpers de acceso a datos.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';

const LEADS_TABLE = process.env.LEADS_TABLE;           // carcompra-leads
const VENDEDORES_TABLE = process.env.VENDEDORES_TABLE; // carcompra-vendedores

// Cliente base + Document Client (marshalling automatico de tipos JS).
const baseClient = new DynamoDBClient({ region: REGION });
export const ddb = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Guarda el lead solo si no existe ya (dedupe por leadId = wamid de WhatsApp).
 * @returns {Promise<boolean>} true si se guardo, false si era duplicado.
 */
export async function saveLeadIfNew(lead) {
  try {
    await ddb.send(new PutCommand({
      TableName: LEADS_TABLE,
      Item: lead,
      ConditionExpression: 'attribute_not_exists(leadId)',
    }));
    return true;
  } catch (err) {
    // Si el leadId ya existe, WhatsApp reintento el mismo mensaje: es duplicado.
    if (err.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw err;
  }
}

// Estados que cierran un caso: un mensaje posterior del mismo cliente abre uno nuevo.
const ESTADOS_CERRADOS = new Set(['cerrado', 'perdido']);

/** Un lead cuenta como activo mientras su estado no sea cerrado/perdido. */
export function esLeadActivo(lead) {
  return !ESTADOS_CERRADOS.has(String(lead?.estado || '').toLowerCase());
}

/**
 * Busca un lead ACTIVO (no cerrado/perdido) para un telefono.
 * Un cliente = un caso: los mensajes siguientes se acumulan en su lead activo
 * en vez de crear leads nuevos que reboten entre vendedores.
 * (Volumen bajo: Scan con filtro es suficiente; migrar a GSI si crece.)
 * @returns {Promise<object|null>} el lead activo o null.
 */
export async function leadActivoPorTelefono(telefono) {
  if (!telefono) return null;
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: LEADS_TABLE,
      FilterExpression: 'telefono = :t',
      ExpressionAttributeValues: { ':t': telefono },
      ExclusiveStartKey,
    }));
    const activo = (res.Items || []).find(
      (l) => !ESTADOS_CERRADOS.has(String(l.estado || '').toLowerCase())
    );
    if (activo) return activo;
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return null;
}

/**
 * Leads ACTIVOS asignados a un vendedor, del mas reciente al mas antiguo.
 * Se usa para enrutar la respuesta que el vendedor manda desde su celular.
 * @returns {Promise<Array>} leads activos del vendedor.
 */
export async function leadsActivosPorVendedor(vendedorId) {
  if (!vendedorId) return [];
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: LEADS_TABLE,
      IndexName: 'gsi-vendedor',
      KeyConditionExpression: 'vendedorId = :v',
      ExpressionAttributeValues: { ':v': vendedorId },
      ScanIndexForward: false, // SK = creadoEn, mas reciente primero
      ExclusiveStartKey,
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items.filter(esLeadActivo);
}

/**
 * Busca el lead cuyo reenvio al vendedor tiene este wamid: permite que el
 * vendedor conteste CITANDO el mensaje reenviado y llegue al caso correcto.
 * (Volumen bajo: Scan con filtro es suficiente; migrar a GSI si crece.)
 * @returns {Promise<object|null>} el lead o null.
 */
export async function leadPorWamidReenvio(wamid) {
  if (!wamid) return null;
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: LEADS_TABLE,
      FilterExpression: 'contains(wamidsReenvio, :w)',
      ExpressionAttributeValues: { ':w': wamid },
      ExclusiveStartKey,
    }));
    if (res.Items?.length) return res.Items[0];
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return null;
}

/**
 * Registra el wamid de un mensaje que el negocio le envio al vendedor
 * (notificacion o reenvio), para poder resolver respuestas citadas.
 * Nunca lanza: perder un wamid solo degrada el enrutado por cita.
 */
export async function registrarWamidReenvio(leadId, wamid) {
  if (!leadId || !wamid) return;
  try {
    await ddb.send(new UpdateCommand({
      TableName: LEADS_TABLE,
      Key: { leadId },
      UpdateExpression:
        'SET wamidsReenvio = list_append(if_not_exists(wamidsReenvio, :vacio), :w)',
      ExpressionAttributeValues: { ':vacio': [], ':w': [wamid] },
    }));
  } catch (err) {
    console.error('No se pudo registrar wamid de reenvio', {
      leadId,
      error: err.message,
    });
  }
}

/**
 * Devuelve los vendedores activos ordenados por 'orden' ascendente.
 * @returns {Promise<Array>} lista de vendedores activos.
 */
export async function activeVendedores() {
  const res = await ddb.send(new ScanCommand({ TableName: VENDEDORES_TABLE }));
  const items = res.Items || [];
  return items
    .filter((v) => v.activo === true)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}
