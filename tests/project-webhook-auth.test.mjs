import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_A, KEY_B, PROJECT_KEYS, webhookHarness, webhookRequest } from './helpers/webhook-harness.mjs';

const managerA = { user_id: 'manager_a', rol: 'empresa_admin', empresa_id: 'company_a' };
const sellerA = { user_id: 'seller_a', rol: 'vendedor', empresa_id: 'company_a' };
function authorize(harness, request = webhookRequest(), project = 'project_a') {
  return harness.load('lib/project-webhook-auth.ts').requireProjectWebhookAccess(request, project);
}

test('anonymous request is rejected before any project/ticket query', async () => {
  const h = webhookHarness();
  const result = await authorize(h);
  assert.equal(result.error.status, 401);
  assert.equal(h.queries.length, 0);
});

test('seller cannot use the manager/integration mutation contract', async () => {
  const h = webhookHarness({ session: sellerA });
  assert.equal((await authorize(h)).error.status, 403);
  assert.equal(h.queries.length, 0);
});

test('company manager cannot operate on another company project', async () => {
  const h = webhookHarness({ session: managerA });
  assert.equal((await authorize(h, webhookRequest({ project: 'project_b' }), 'project_b')).error.status, 403);
  assert.equal(h.queries.some((query) => query.table === 'boletas'), false);
});

test('company manager receives the project company from the server', async () => {
  const h = webhookHarness({ session: managerA });
  const result = await authorize(h, webhookRequest({ body: { empresa_id: 'company_b' } }));
  assert.equal(result.error, null);
  assert.equal(result.proyecto.empresa_id, 'company_a');
});

test('super admin is allowed through the existing manager guard', async () => {
  const h = webhookHarness({ session: { user_id: 'root', rol: 'super_admin' } });
  assert.equal((await authorize(h)).error, null);
});

test('valid integration key is limited to its project and server-derived company', async () => {
  const h = webhookHarness();
  const result = await authorize(h, webhookRequest({ key: KEY_A }));
  assert.equal(result.error, null);
  assert.equal(result.proyecto.id, 'project_a');
  assert.equal(result.proyecto.empresa_id, 'company_a');
  assert.equal(h.queries.length, 1);
  assert.equal(h.queries[0].url.searchParams.get('estado'), 'eq.activo');
});

for (const [name, keys, key, project] of [
  ['wrong key', PROJECT_KEYS, KEY_B, 'project_a'],
  ['key A on project B', PROJECT_KEYS, KEY_A, 'project_b'],
  ['unconfigured keys', undefined, KEY_A, 'project_a'],
  ['revoked key', JSON.stringify({ project_b: KEY_B }), KEY_A, 'project_a'],
  ['unknown project', PROJECT_KEYS, KEY_A, 'unknown'],
  ['public sales capability', PROJECT_KEYS, 'fixture_public_sales_0000000000000000000', 'project_a'],
]) {
  test(`${name} is rejected before a database query`, async () => {
    const h = webhookHarness({ keys: keys ?? '' });
    const result = await authorize(h, webhookRequest({ key, project }), project);
    assert.equal(result.error.status, 401);
    assert.equal(h.queries.length, 0);
  });
}

for (const keys of ['{invalid', '[]', '{"project_a":"short"}', JSON.stringify({ project_a: KEY_A, project_b: KEY_A })]) {
  test(`invalid/reused credential configuration fails closed: ${keys.slice(0, 20)}`, async () => {
    const h = webhookHarness({ keys });
    const result = await authorize(h, webhookRequest({ key: KEY_A }));
    assert.equal(result.error.status, 503);
    assert.equal(h.queries.length, 0);
    assert.equal(JSON.stringify(h.logs).includes(KEY_A), false);
    assert.equal((await result.error.text()).includes(KEY_A), false);
  });
}

test('an invalid Authorization header never falls back to a valid cookie session', async () => {
  const h = webhookHarness({ session: managerA });
  assert.equal((await authorize(h, webhookRequest({ headers: { Authorization: 'Basic fixture' } }))).error.status, 401);
  assert.equal(h.queries.length, 0);
});

test('credential in the payload is not authentication', async () => {
  const h = webhookHarness();
  assert.equal((await authorize(h, webhookRequest({ body: { key: KEY_A, empresa_id: 'company_a' } }))).error.status, 401);
});

test('a foreign Origin cannot use cookie authentication', async () => {
  const h = webhookHarness({ session: managerA });
  assert.equal((await authorize(h, webhookRequest({ headers: { Origin: 'https://untrusted.fixture.test' } }))).error.status, 403);
  assert.equal(h.queries.length, 0);
});

test('integration keys do not authorize inactive or missing projects', async () => {
  const h = webhookHarness({ seed: { proyectos: [{ id: 'project_a', empresa_id: 'company_a', estado: 'inactivo' }] } });
  assert.equal((await authorize(h, webhookRequest({ key: KEY_A }))).error.status, 404);
});

test('authorization database errors return no raw error details', async () => {
  const h = webhookHarness({ failTable: 'proyectos' });
  const result = await authorize(h, webhookRequest({ key: KEY_A }));
  assert.equal(result.error.status, 503);
  assert.equal((await result.error.text()).includes('fixture_private_database_error'), false);
});

test('nested JSON and form payloads preserve the documented GHL fields', async () => {
  const parser = webhookHarness().load('lib/boleta-webhook-payload.ts');
  const json = await parser.readWebhookPayload(webhookRequest({ body: { contact: { consecutivo_1: '42' }, customData: { empresa_id: 'company_a' } } }));
  assert.equal(parser.payloadText(json, ['contact.consecutivo_1']), '42');
  assert.equal(parser.payloadText(json, ['customData.empresa_id']), 'company_a');
  const form = await parser.readWebhookPayload(new Request('https://pulse.fixture.test', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'nombre=Cliente+Fixture&numero=42',
  }));
  assert.equal(form.nombre, 'Cliente Fixture');
  assert.equal(parser.webhookTicketNumber(form.numero), '0042');
});

test('invalid JSON and primitive JSON bodies are rejected', async () => {
  const parser = webhookHarness().load('lib/boleta-webhook-payload.ts');
  for (const body of ['{invalid', 'null', '[]', '42']) {
    await assert.rejects(parser.readWebhookPayload(new Request('https://pulse.fixture.test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })), /cuerpo/);
  }
});

test('ticket numbers cannot silently truncate or discard non-numeric input', () => {
  const parser = webhookHarness().load('lib/boleta-webhook-payload.ts');
  assert.equal(parser.webhookTicketNumber('42'), '0042');
  for (const value of ['', '10042', 'abc42', '-42']) assert.throws(() => parser.webhookTicketNumber(value));
});

test('known state aliases remain compatible and unknown states cannot mutate a ticket', () => {
  const parser = webhookHarness().load('lib/boleta-webhook-payload.ts');
  assert.equal(parser.webhookTicketState(''), 'No disponible');
  assert.equal(parser.webhookTicketState('pagada'), 'Pagado');
  assert.throws(() => parser.webhookTicketState('constructor'));
  assert.throws(() => parser.webhookTicketState('invalid'));
});

test('valid COP amounts are normalized without deleting invalid characters or signs', () => {
  const parser = webhookHarness().load('lib/boleta-webhook-payload.ts');
  for (const value of ['60000', '60,000', '60.000', '$ 60.000', 'COP 60000', '60000,00']) {
    assert.equal(parser.webhookPayment(value), 60000);
  }
  assert.equal(parser.webhookPayment('0'), 0);
  assert.equal(parser.webhookPayment(''), undefined);
  for (const value of ['-500', 'abc500', 'NaN', 'Infinity', '1e3', '9007199254740992']) {
    assert.throws(() => parser.webhookPayment(value));
  }
});
