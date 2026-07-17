// Asignacion de vendedor mediante round-robin atomico sobre carcompra-config.
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, activeVendedores } from './dynamo.mjs';

const CONFIG_TABLE = process.env.CONFIG_TABLE; // carcompra-config

/**
 * Selecciona el siguiente vendedor en rotacion round-robin.
 * El contador se incrementa con la operacion atomica ADD, por lo que
 * leads concurrentes obtienen indices distintos sin colisionar.
 * @returns {Promise<object|null>} vendedor asignado o null si no hay activos.
 */
export async function assignVendedor() {
  const list = await activeVendedores();
  if (list.length === 0) return null;

  // Incremento atomico del contador global de rotacion.
  const res = await ddb.send(new UpdateCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'roundrobin' },
    UpdateExpression: 'ADD #c :one',
    ExpressionAttributeNames: { '#c': 'counter' },
    ExpressionAttributeValues: { ':one': 1 },
    ReturnValues: 'UPDATED_NEW',
  }));

  const newCount = res.Attributes.counter;
  const index = (newCount - 1) % list.length;
  return list[index];
}
