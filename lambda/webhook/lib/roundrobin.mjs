// Asignacion de vendedor mediante round-robin atomico sobre carcompra-config.
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, activeVendedores } from './dynamo.mjs';

const CONFIG_TABLE = process.env.CONFIG_TABLE; // carcompra-config

/**
 * Selecciona el siguiente vendedor en rotacion round-robin PONDERADA.
 * Cada vendedor puede tener un atributo `peso` (default 1): con Paul peso=2 y
 * Miguel peso=1 el ciclo es [Paul, Paul, Miguel] y se repite. El contador se
 * incrementa con la operacion atomica ADD, por lo que leads concurrentes
 * obtienen indices distintos sin colisionar.
 * @returns {Promise<object|null>} vendedor asignado o null si no hay activos.
 */
export async function assignVendedor() {
  const list = await activeVendedores();
  if (list.length === 0) return null;

  // Ciclo ponderado en orden de `orden`: peso N => N turnos consecutivos.
  const ciclo = list.flatMap((v) => {
    const peso = Math.max(1, Math.trunc(Number(v.peso) || 1));
    return Array(peso).fill(v);
  });

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
  const index = (newCount - 1) % ciclo.length;
  return ciclo[index];
}
