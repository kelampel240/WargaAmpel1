import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel) => readFileSync(join(root, rel), 'utf8');

function filesUnder(rel, pattern) {
  return readdirSync(join(root, rel)).flatMap((name) => {
    const child = `${rel}/${name}`;
    if (statSync(join(root, child)).isDirectory()) return filesUnder(child, pattern);
    return pattern.test(name) ? [child] : [];
  });
}

test('kode GAS tidak memuat kata sandi tetap atau ID Google literal', () => {
  for (const rel of filesUnder('gas', /\.(gs|json)$/)) {
    const text = read(rel);
    assert.doesNotMatch(text, /AdminAmpel2026/, `${rel} memuat kata sandi lama`);
    assert.doesNotMatch(text, /openById\(\s*['"][\w-]{20,}['"]/, `${rel} memuat ID spreadsheet literal`);
    assert.doesNotMatch(text, /getFolderById\(\s*['"][\w-]{20,}['"]/, `${rel} memuat ID folder literal`);
  }
});

test('antarmuka tidak memuat rahasia server maupun tautan Drive langsung', () => {
  for (const rel of filesUnder('src', /\.(ts|tsx)$/)) {
    assert.doesNotMatch(read(rel), /SESSION_SECRET|ADMIN_AWAL_PASSWORD|AdminAmpel2026/, `${rel} memuat rahasia`);
  }
  for (const rel of filesUnder('src', /\.tsx$/)) {
    assert.doesNotMatch(read(rel), /drive\.google\.com|DRIVE_URL|previewUrl/, `${rel} memakai tautan Drive`);
  }
});

test('manifest Apps Script: zona waktu, akses Web App, dan izin yang diminta', () => {
  const manifest = JSON.parse(read('gas/appsscript.json'));
  assert.equal(manifest.timeZone, 'Asia/Jakarta');
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.deepEqual(
    [...manifest.oauthScopes].sort(),
    ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
  );
});

test('berkas rahasia diabaikan Git dan .env.example hanya berisi placeholder', () => {
  const ignore = read('.gitignore').split(/\r?\n/);
  for (const entry of ['node_modules/', 'dist/', '.env', '.env.local']) {
    assert.ok(ignore.includes(entry), `${entry} harus ada di .gitignore`);
  }
  assert.match(read('.env.example'), /^VITE_GAS_WEB_APP_URL=\s*$/m);
});

test('workflow GitHub Pages menjalankan lint, tes, lalu build sebelum terbit', () => {
  const workflow = read('.github/workflows/deploy-pages.yml');
  const steps = ['npm ci', 'npm run lint', 'npm test', 'npm run build', 'actions/deploy-pages@v4'];
  const positions = steps.map((step) => {
    const index = workflow.indexOf(step);
    assert.notEqual(index, -1, `langkah "${step}" tidak ditemukan di workflow`);
    return index;
  });
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'urutan langkah workflow salah');
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /VITE_GAS_WEB_APP_URL: \$\{\{ vars\.VITE_GAS_WEB_APP_URL \}\}/);
  assert.match(workflow, /node-version: 22/);
});
