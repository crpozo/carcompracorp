#!/usr/bin/env node
// -----------------------------------------------------------------------------
// smoke-test.mjs — verificación de integridad del CRM (SOLO LECTURA).
// No envía WhatsApp ni modifica datos. Corre cuando quieras auditar el estado:
//   node scripts/smoke-test.mjs
//
// Comprueba:
//   1. Un chat por cliente: ningún teléfono con más de un lead.
//   2. Historial bien formado (cada entrada con de/texto/en).
//   3. Cada lead asignado apunta a un vendedor que existe.
//   4. Round-robin: pesos válidos y contador numérico.
//   5. Reparto real vs configurado (informativo).
// Sale con código 1 si algún check crítico falla (útil para CI).
// -----------------------------------------------------------------------------
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function scanAll(TableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

const ok = (m) => console.log(`  ✅ ${m}`);
const fail = (m) => { console.log(`  ❌ ${m}`); process.exitCode = 1; };
const info = (m) => console.log(`  •  ${m}`);

const leads = await scanAll('carcompra-leads');
const vendedores = await scanAll('carcompra-vendedores');
const cfg = await ddb.send(new GetCommand({ TableName: 'carcompra-config', Key: { pk: 'roundrobin' } }));
const vendById = new Map(vendedores.map((v) => [v.vendedorId, v]));

console.log(`\nCRM smoke test — ${leads.length} leads, ${vendedores.length} vendedores\n`);

// 1. Un chat por cliente
console.log('1) Un chat por cliente (sin duplicados)');
const porTel = new Map();
for (const l of leads) porTel.set(l.telefono, (porTel.get(l.telefono) || 0) + 1);
const dups = [...porTel.entries()].filter(([, n]) => n > 1);
if (dups.length === 0) ok('Ningún teléfono tiene más de un lead.');
else dups.forEach(([t, n]) => fail(`El teléfono ${t} tiene ${n} leads (duplicado).`));

// 2. Historial bien formado
console.log('2) Historial bien formado');
let malos = 0;
for (const l of leads) {
  for (const h of l.historial || []) {
    if (typeof h?.texto !== 'string' || typeof h?.en !== 'string') malos++;
  }
}
malos === 0 ? ok('Todas las entradas de historial tienen texto y fecha.')
            : fail(`${malos} entradas de historial mal formadas.`);

// 3. Asignaciones válidas
console.log('3) Asignaciones de vendedor válidas');
const huerfanos = leads.filter((l) => l.vendedorId && !vendById.has(l.vendedorId));
huerfanos.length === 0 ? ok('Todo lead asignado apunta a un vendedor existente.')
  : fail(`${huerfanos.length} leads apuntan a un vendedor inexistente: ${[...new Set(huerfanos.map((l) => l.vendedorId))].join(', ')}`);

// 4. Round-robin
console.log('4) Round-robin');
const counter = cfg.Item?.counter;
typeof counter === 'number' ? ok(`Contador = ${counter} (numérico).`) : fail(`Contador inválido: ${counter}`);
const pesosMal = vendedores.filter((v) => v.peso !== undefined && !(Number(v.peso) >= 1));
pesosMal.length === 0 ? ok('Pesos válidos (>= 1).') : fail(`Pesos inválidos en: ${pesosMal.map((v) => v.nombre).join(', ')}`);

// 5. Reparto real (informativo)
console.log('5) Reparto real vs configurado');
const activos = vendedores.filter((v) => v.activo === true).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
info('Configurado: ' + activos.map((v) => `${v.nombre} x${v.peso ?? 1}`).join(', '));
const real = {};
for (const l of leads) if (l.vendedorId) real[l.vendedorId] = (real[l.vendedorId] || 0) + 1;
info('Real: ' + activos.map((v) => `${v.nombre}=${real[v.vendedorId] || 0}`).join(', '));

console.log(process.exitCode ? '\n❌ Hay checks fallidos.\n' : '\n✅ Todos los checks pasaron.\n');
