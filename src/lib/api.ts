import type { PublicUserSession, ReportStatus } from '../shared/types';
import { isValidGasWebAppUrl, mapRestToGasCall } from './gasBridge';

const TOKEN_STORAGE_KEY = 'siwarga_auth_token';
const USER_STORAGE_KEY = 'siwarga_auth_user';
const GAS_URL_STORAGE_KEY = 'warga_ampel_gas_url';

export const GAS_NOT_CONFIGURED_MESSAGE =
  'Alamat Web App Google Apps Script belum diatur. Isi variabel GitHub VITE_GAS_WEB_APP_URL, atau buka aplikasi dengan ?gasUrl=<alamat /exec>.';

const GAS_NOT_JSON_MESSAGE =
  'Google Apps Script tidak mengembalikan data JSON. Pastikan Web App di-deploy dengan akses "Anyone" dan alamat yang dipakai berakhiran /exec.';

/** Alamat Web App: dari ?gasUrl= (disimpan di localStorage), lalu dari localStorage, lalu dari build. */
export function getGasWebAppUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const fromQuery = new URLSearchParams(window.location.search).get('gasUrl') || '';
      if (isValidGasWebAppUrl(fromQuery)) {
        localStorage.setItem(GAS_URL_STORAGE_KEY, fromQuery.trim());
        return fromQuery.trim();
      }
      const fromStorage = localStorage.getItem(GAS_URL_STORAGE_KEY) || '';
      if (isValidGasWebAppUrl(fromStorage)) {
        return fromStorage.trim();
      }
    }
  } catch {
    // penyimpanan tidak tersedia (mode privat, dll.)
  }
  const fromEnv = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GAS_WEB_APP_URL || '';
  const configuredUrl = fromEnv.trim() || 'https://script.google.com/macros/s/AKfycbxmODwRVjfGht162FycYsW_0MF0hno4ABgc9kojE093514SVGSZotdusr-fjHfGICLw/exec';
  return isValidGasWebAppUrl(configuredUrl) ? configuredUrl : '';
}

export function isGasMode(): boolean {
  return getGasWebAppUrl().length > 0;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): PublicUserSession | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PublicUserSession) : null;
  } catch {
    return null;
  }
}

export function persistAuth(token: string, user: PublicUserSession): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // penyimpanan tidak tersedia
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // penyimpanan tidak tersedia
  }
}

function parseJsonBody(body: RequestInit['body']): Record<string, unknown> {
  if (typeof body !== 'string' || !body.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Satu-satunya jalur data aplikasi: setiap panggilan REST dipetakan ke aksi GAS
 * lalu dikirim sebagai POST text/plain ke Web App (tanpa preflight CORS).
 */
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const gasUrl = getGasWebAppUrl();
  if (!gasUrl) {
    throw new Error(GAS_NOT_CONFIGURED_MESSAGE);
  }

  const method = (options.method || 'GET').toUpperCase();
  const bodyObj = parseJsonBody(options.body);
  const spec = mapRestToGasCall(url, method, bodyObj, getStoredToken());

  // Uji koneksi menerima URL Web App lain (hanya bila formatnya valid), selain itu memakai URL aktif.
  const isTestGas = url === '/api/admin/test-gas';
  const testUrl = typeof bodyObj.url === 'string' ? bodyObj.url.trim() : '';
  const targetUrl = isTestGas && isValidGasWebAppUrl(testUrl) ? testUrl : gasUrl;

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: spec.action, payload: spec.payload, token: spec.token || '' }),
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke Google Apps Script. Periksa koneksi internet dan alamat Web App.');
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(GAS_NOT_JSON_MESSAGE);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(GAS_NOT_JSON_MESSAGE);
  }
  if (!res.ok) {
    throw new Error(`Google Apps Script membalas status ${res.status}.`);
  }
  const data = parsed as Record<string, unknown>;
  if (data.error) {
    throw new Error(String(data.error));
  }
  if (isTestGas) {
    return { ok: true, status: res.status, preview: text.slice(0, 300) } as unknown as T;
  }
  return data as T;
}

export async function downloadCsvExport(): Promise<void> {
  const res = await apiFetch<{ csv?: string; filename?: string }>('/api/admin/export');
  if (!res.csv) {
    throw new Error('Berkas ekspor kosong.');
  }
  const objectUrl = URL.createObjectURL(new Blob([res.csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = res.filename || 'LAPORAN_WARGA_AMPEL.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Data verifikasi untuk warga yang tidak sedang login (sama seperti pelacakan laporan). */
export interface EvidenceVerifier {
  ticketId?: string;
  tanggalLahir?: string;
  last4Hp?: string;
}

export interface EvidenceBlob {
  fileName: string;
  mimeType: string;
  blob: Blob;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

/** Mengambil berkas bukti dari backend. Berkas tidak pernah dikirim lewat URL Drive. */
export async function fetchEvidenceFile(idBukti: string, verifier: EvidenceVerifier = {}): Promise<EvidenceBlob> {
  const params = new URLSearchParams();
  if (verifier.ticketId) params.set('ticketId', verifier.ticketId);
  if (verifier.tanggalLahir) params.set('tanggalLahir', verifier.tanggalLahir);
  if (verifier.last4Hp) params.set('last4Hp', verifier.last4Hp);
  const query = params.toString();
  const path = `/api/evidence/${encodeURIComponent(idBukti)}`;
  const data = await apiFetch<{ fileName: string; mimeType: string; base64: string }>(
    query ? `${path}?${query}` : path
  );
  return {
    fileName: data.fileName,
    mimeType: data.mimeType,
    blob: base64ToBlob(data.base64, data.mimeType),
  };
}

/** Membuka bukti di tab baru. Tab dibuka lebih dulu agar tidak diblokir popup blocker. */
export async function openEvidenceInNewTab(idBukti: string, verifier: EvidenceVerifier = {}): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const file = await fetchEvidenceFile(idBukti, verifier);
    const objectUrl = URL.createObjectURL(file.blob);
    if (tab) {
      tab.location.href = objectUrl;
    } else {
      window.open(objectUrl, '_blank');
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export function readFileAsBase64(file: File): Promise<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        base64: String(reader.result || ''),
      });
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

export function formatTanggalIndo(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getStatusVisual(status: ReportStatus): {
  textClass: string;
  bgClass: string;
  borderClass: string;
  shortLabel: string;
} {
  switch (status) {
    case 'Laporan diterima':
      return {
        textClass: 'text-slate-800',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        shortLabel: 'Diterima',
      };
    case 'Sedang ditindaklanjuti':
      return {
        textClass: 'text-sky-900',
        bgClass: 'bg-sky-50',
        borderClass: 'border-sky-300',
        shortLabel: 'Ditindaklanjuti',
      };
    case 'Sedang dalam proses perbaikan':
      return {
        textClass: 'text-amber-900',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-300',
        shortLabel: 'Dalam Perbaikan',
      };
    case 'Sudah diusulkan ke dinas terkait':
    case 'Menunggu tindak lanjut dinas':
      return {
        textClass: 'text-indigo-900',
        bgClass: 'bg-indigo-50',
        borderClass: 'border-indigo-300',
        shortLabel: 'Usulan Dinas',
      };
    case 'Sudah diperbaiki atau ditangani':
      return {
        textClass: 'text-emerald-900',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-300',
        shortLabel: 'Selesai',
      };
    case 'Tidak dapat ditindaklanjuti':
      return {
        textClass: 'text-rose-900',
        bgClass: 'bg-rose-50',
        borderClass: 'border-rose-300',
        shortLabel: 'Tidak Dapat Ditindaklanjuti',
      };
    default:
      return {
        textClass: 'text-slate-800',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        shortLabel: status,
      };
  }
}
