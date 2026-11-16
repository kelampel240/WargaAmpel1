import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_ACTIONS, isValidGasWebAppUrl, mapRestToGasCall } from './gasBridge';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..');
const repoDir = join(here, '..', '..');

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
  });
}

/** Nama aksi pada `case '...'` di dalam fungsi dispatch_ gas/Code.gs saja. */
function dispatchCases(codeGs: string): Set<string> {
  const start = codeGs.indexOf('function dispatch_(');
  assert.notEqual(start, -1, 'dispatch_ tidak ditemukan di gas/Code.gs');
  const rest = codeGs.slice(start + 1);
  const next = rest.search(/\nfunction /);
  const body = next === -1 ? rest : rest.slice(0, next);
  return new Set([...body.matchAll(/case '(\w+)'/g)].map((m) => m[1]));
}

/** Endpoint /api/... yang tertulis sebagai literal di kode antarmuka. ${...} diganti X. */
function uiEndpoints(): string[] {
  const found = new Set<string>();
  for (const file of listSourceFiles(srcDir)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(['"`])(\/api\/[^'"`\s]*)\1/g)) {
      found.add(match[2].replace(/\$\{[^}]*\}/g, 'X'));
    }
  }
  return [...found].sort();
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function mapsForSomeMethod(url: string): boolean {
  return HTTP_METHODS.some((method) => {
    try {
      mapRestToGasCall(url, method, {}, 'token');
      return true;
    } catch {
      return false;
    }
  });
}

test('isValidGasWebAppUrl validates standard and Workspace GAS Web App URLs', () => {
  assert.equal(isValidGasWebAppUrl('https://script.google.com/macros/s/AKfycbx123456/exec'), true);
  assert.equal(
    isValidGasWebAppUrl('https://script.google.com/a/ampel.desa.id/macros/s/AKfycbx123456/exec'),
    true
  );
  assert.equal(isValidGasWebAppUrl('http://localhost:3000/api'), false);
  assert.equal(isValidGasWebAppUrl(''), false);
});

test('mapRestToGasCall maps public, auth, reporting, and admin routes accurately', () => {
  const pub = mapRestToGasCall('/api/public/services', 'GET');
  assert.equal(pub.action, 'getPublicServices');

  const login = mapRestToGasCall('/api/auth/login', 'POST', { username: 'admin', password: 'secret' });
  assert.equal(login.action, 'authenticateUser');
  assert.equal(login.payload.username, 'admin');

  const followUp = mapRestToGasCall(
    '/api/admin/reports/SW-2026-000001/followup',
    'POST',
    { status: 'Sedang ditindaklanjuti', keterangan: 'Sudah dicek di lapangan' },
    'tok-123'
  );
  assert.equal(followUp.action, 'saveFollowUp');
  assert.equal(followUp.payload.idLaporan, 'SW-2026-000001');
  assert.equal(followUp.token, 'tok-123');

  const listFiltered = mapRestToGasCall('/api/admin/reports?group=A.%20Pengaduan&search=jalan', 'GET', {}, 'tok-123');
  assert.equal(listFiltered.action, 'getAllReports');
  assert.equal(listFiltered.payload.group, 'A. Pengaduan');
  assert.equal(listFiltered.payload.search, 'jalan');
});

test('daftar laporan hanya meneruskan filter yang terisi', () => {
  const spec = mapRestToGasCall('/api/admin/reports?group=&status=Laporan%20diterima', 'GET', {}, 'tok');
  assert.deepEqual(spec.payload, { status: 'Laporan diterima' });
});

test('evidence GET membawa verifikasi tanpa membawa URL Drive', () => {
  const spec = mapRestToGasCall(
    '/api/evidence/BKT-0001?ticketId=SW-2026-000001&tanggalLahir=1975-07-14&last4Hp=',
    'GET'
  );
  assert.equal(spec.action, 'getDriveEvidence');
  assert.deepEqual(spec.payload, {
    idBukti: 'BKT-0001',
    ticketId: 'SW-2026-000001',
    tanggalLahir: '1975-07-14',
  });
  assert.equal(spec.token, undefined);
});

test('verifikasi warga menerima PATCH maupun POST dan meneruskan status', () => {
  for (const method of ['PATCH', 'POST']) {
    const spec = mapRestToGasCall('/api/admin/warga/WRG-1/verify', method, { status: 'TERVERIFIKASI' }, 'tok');
    assert.equal(spec.action, 'verifyWarga');
    assert.equal(spec.payload.idWarga, 'WRG-1');
    assert.equal(spec.payload.statusVerifikasi, 'TERVERIFIKASI');
    assert.equal(spec.token, 'tok');
  }
});

test('uji koneksi tidak membawa token maupun URL uji ke GAS', () => {
  const spec = mapRestToGasCall(
    '/api/admin/test-gas',
    'POST',
    { url: 'https://script.google.com/macros/s/AKfycbx123456/exec' },
    'tok'
  );
  assert.equal(spec.action, 'ping');
  assert.deepEqual(spec.payload, {});
  assert.equal(spec.token, undefined);
});

test('rute yang sudah dihapus tidak lagi dipetakan', () => {
  assert.throws(() => mapRestToGasCall('/api/citizen/reports', 'GET'), /belum dipetakan/);
  assert.throws(() => mapRestToGasCall('/api/gas-bundle', 'GET'), /belum dipetakan/);
});

test('kontrak: setiap aksi bridge ada sebagai case di dispatch_ gas/Code.gs', () => {
  const cases = dispatchCases(readFileSync(join(repoDir, 'gas', 'Code.gs'), 'utf8'));
  const missing = ROUTE_ACTIONS.filter((action) => !cases.has(action));
  assert.deepEqual(missing, []);
});

test('kontrak: setiap endpoint /api yang dipakai antarmuka punya pemetaan', () => {
  const endpoints = uiEndpoints();
  assert.ok(endpoints.length >= 20, `hanya ${endpoints.length} endpoint terbaca; pemindaian mungkin rusak`);
  const unmapped = endpoints.filter((url) => !mapsForSomeMethod(url));
  assert.deepEqual(unmapped, []);
});
