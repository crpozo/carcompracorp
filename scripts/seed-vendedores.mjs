#!/usr/bin/env node
//
// seed-vendedores.mjs
// -----------------------------------------------------------------------------
// Carga la lista de vendedores en la tabla DynamoDB `carcompra-vendedores` e
// inicializa el contador de round-robin en `carcompra-config`.
//
// Fuente de datos: ./vendedores.json (en la raíz del repo), un array de objetos:
//   { vendedorId?, nombre, telefono, activo?, orden? }
//
//   * vendedorId : opcional. Si falta, se deriva un slug a partir de `nombre`.
//   * activo     : opcional. Por defecto true.
//   * orden      : opcional. Por defecto la posición en el array (1-based).
//
// Uso:
//   node scripts/seed-vendedores.mjs
//
// No maneja secretos. Usa las credenciales del AWS CLI del entorno.
// -----------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const VENDEDORES_TABLE = process.env.VENDEDORES_TABLE || 'carcompra-vendedores';
const CONFIG_TABLE = process.env.CONFIG_TABLE || 'carcompra-config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '..', 'vendedores.json');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// Deriva un slug URL-safe a partir del nombre: minúsculas, sin acentos, guiones.
function slugify(nombre) {
  return String(nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar diacríticos (combining marks)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Parte un array en lotes de tamaño `size` (BatchWrite admite máx. 25).
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  // --- Leer y validar la fuente de datos ---
  let raw;
  try {
    raw = await readFile(DATA_FILE, 'utf8');
  } catch {
    console.error(`ERROR: no se encontró ${DATA_FILE}.`);
    console.error('Copia vendedores.example.json a vendedores.json y edítalo.');
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: ${DATA_FILE} no es JSON válido: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(input) || input.length === 0) {
    console.error('ERROR: el archivo debe ser un array con al menos un vendedor.');
    process.exit(1);
  }

  // --- Normalizar cada vendedor ---
  const seenIds = new Set();
  const vendedores = input.map((v, i) => {
    if (!v || !v.nombre || !v.telefono) {
      throw new Error(`El vendedor en la posición ${i} necesita 'nombre' y 'telefono'.`);
    }
    const vendedorId = (v.vendedorId && String(v.vendedorId).trim()) || slugify(v.nombre);
    if (!vendedorId) {
      throw new Error(`No se pudo derivar un vendedorId para "${v.nombre}".`);
    }
    if (seenIds.has(vendedorId)) {
      throw new Error(`vendedorId duplicado: "${vendedorId}". Deben ser únicos.`);
    }
    seenIds.add(vendedorId);

    return {
      vendedorId,
      nombre: String(v.nombre),
      telefono: String(v.telefono),
      activo: v.activo === undefined ? true : Boolean(v.activo),
      orden: v.orden === undefined ? i + 1 : Number(v.orden),
    };
  });

  // --- Escribir vendedores en lotes de 25 (BatchWrite) ---
  const batches = chunk(vendedores, 25);
  let written = 0;
  for (const batch of batches) {
    const requestItems = {
      [VENDEDORES_TABLE]: batch.map((item) => ({ PutRequest: { Item: item } })),
    };
    let response = await client.send(new BatchWriteCommand({ RequestItems: requestItems }));

    // Reintentar los items no procesados (backoff simple).
    let unprocessed = response.UnprocessedItems || {};
    let attempt = 0;
    while (unprocessed[VENDEDORES_TABLE] && unprocessed[VENDEDORES_TABLE].length > 0) {
      attempt += 1;
      if (attempt > 5) {
        throw new Error('Demasiados items sin procesar tras 5 reintentos.');
      }
      await new Promise((r) => setTimeout(r, 200 * attempt));
      response = await client.send(new BatchWriteCommand({ RequestItems: unprocessed }));
      unprocessed = response.UnprocessedItems || {};
    }
    written += batch.length;
  }

  // --- Inicializar el item round-robin si no existe ---
  const existing = await client.send(
    new GetCommand({ TableName: CONFIG_TABLE, Key: { pk: 'roundrobin' } }),
  );

  let roundrobinCreated = false;
  if (!existing.Item) {
    await client.send(
      new PutCommand({
        TableName: CONFIG_TABLE,
        Item: { pk: 'roundrobin', counter: 0 },
        // No pisar si otro proceso lo creó entre el Get y el Put.
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
    roundrobinCreated = true;
  }

  // --- Resumen ---
  console.log('====================================================');
  console.log(`Vendedores cargados : ${written}`);
  vendedores.forEach((v) => {
    const estado = v.activo ? 'activo' : 'inactivo';
    console.log(`  [${v.orden}] ${v.vendedorId}  (${v.nombre}, ${estado})`);
  });
  console.log(`Tabla vendedores    : ${VENDEDORES_TABLE}`);
  console.log(`Tabla config        : ${CONFIG_TABLE}`);
  console.log(
    `Round-robin counter : ${roundrobinCreated ? 'inicializado en 0' : 'ya existía (sin cambios)'}`,
  );
  console.log('====================================================');
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
