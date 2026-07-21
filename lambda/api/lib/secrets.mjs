// Lectura de secretos desde AWS Secrets Manager con cache a nivel de modulo.
// El cache persiste entre invocaciones "warm" del mismo contenedor Lambda,
// evitando llamadas repetidas a Secrets Manager.
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SECRET_ID = process.env.SECRET_ID; // p.ej. "carcompra/whatsapp"

const client = new SecretsManagerClient({ region: REGION });

// Cache en memoria del contenedor (undefined hasta la primera lectura exitosa).
let cachedSecrets;

/**
 * Devuelve el JSON de secretos (WHATSAPP_TOKEN, VERIFY_TOKEN, PHONE_NUMBER_ID).
 * Cachea el resultado para reutilizarlo en invocaciones warm.
 */
export async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const res = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  if (!res.SecretString) {
    throw new Error(`Secret ${SECRET_ID} no contiene SecretString`);
  }

  cachedSecrets = JSON.parse(res.SecretString);
  return cachedSecrets;
}
