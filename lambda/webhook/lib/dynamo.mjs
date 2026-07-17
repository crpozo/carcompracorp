// Cliente DynamoDB (Document Client) y helpers de acceso a datos.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
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
