/**
 * Pemetaan rute REST yang dipakai antarmuka ke aksi Google Apps Script.
 * Setiap aksi di sini harus ada sebagai `case` di dispatch_ pada gas/Code.gs.
 * Kesesuaian itu dijaga oleh tests/contract di gasBridge.test.ts.
 */

export interface GasCallSpec {
  action: string;
  payload: Record<string, unknown>;
  token?: string;
}

const GAS_WEB_APP_PATTERN = /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[^/]+\/exec(\?.*)?$/;

export function isValidGasWebAppUrl(url: string): boolean {
  return GAS_WEB_APP_PATTERN.test(url.trim());
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RouteContext {
  body: Record<string, unknown>;
  query: URLSearchParams;
}

interface Route {
  methods: HttpMethod[];
  path: RegExp;
  action: string;
  /** Jika true, token sesi ikut dikirim. */
  auth?: boolean;
  payload?: (match: RegExpMatchArray, ctx: RouteContext) => Record<string, unknown>;
}

/** Mendekode segmen URL tanpa melempar error bila penulisannya rusak. */
function segment(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Hanya menyertakan parameter query yang terisi agar filter kosong tidak ikut terkirim. */
function queryValues(query: URLSearchParams, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = query.get(key);
    if (value) out[key] = value;
  }
  return out;
}

const bodyPayload = (_match: RegExpMatchArray, ctx: RouteContext) => ctx.body;

const ROUTES: Route[] = [
  // Publik
  { methods: ['GET'], path: /^\/api\/public\/services$/, action: 'getPublicServices' },
  { methods: ['GET'], path: /^\/api\/public\/announcements$/, action: 'getPublicAnnouncements' },

  // Autentikasi warga dan staf
  { methods: ['GET'], path: /^\/api\/auth\/me$/, action: 'getAuthMe', auth: true },
  { methods: ['POST'], path: /^\/api\/auth\/login$/, action: 'authenticateUser', payload: bodyPayload },
  { methods: ['POST'], path: /^\/api\/auth\/register$/, action: 'registerCitizen', payload: bodyPayload },
  { methods: ['POST'], path: /^\/api\/auth\/verify$/, action: 'verifyCitizenAccount', payload: bodyPayload },
  { methods: ['POST'], path: /^\/api\/auth\/reset-password$/, action: 'resetPassword', payload: bodyPayload },

  // Pelaporan dan pelacakan warga
  { methods: ['POST'], path: /^\/api\/reports$/, action: 'submitReport', auth: true, payload: bodyPayload },
  { methods: ['POST'], path: /^\/api\/reports\/track$/, action: 'getReportStatus', payload: bodyPayload },
  { methods: ['GET'], path: /^\/api\/citizen\/dashboard$/, action: 'getCitizenDashboard', auth: true },
  {
    methods: ['POST'],
    path: /^\/api\/citizen\/notifications\/([^/]+)\/read$/,
    action: 'markNotificationRead',
    auth: true,
    payload: (m) => ({ idNotifikasi: segment(m[1]) }),
  },

  // Bukti dokumen: berkas Drive dibaca backend, URL Drive tidak pernah dikirim ke browser
  {
    methods: ['GET'],
    path: /^\/api\/evidence\/([^/]+)$/,
    action: 'getDriveEvidence',
    auth: true,
    payload: (m, ctx) => ({
      idBukti: segment(m[1]),
      ...queryValues(ctx.query, ['ticketId', 'tanggalLahir', 'last4Hp']),
    }),
  },

  // Dashboard dan laporan (admin/petugas)
  { methods: ['GET'], path: /^\/api\/admin\/dashboard$/, action: 'getAdminDashboard', auth: true },
  {
    methods: ['GET'],
    path: /^\/api\/admin\/reports$/,
    action: 'getAllReports',
    auth: true,
    payload: (_m, ctx) => queryValues(ctx.query, ['group', 'status', 'search']),
  },
  {
    methods: ['GET'],
    path: /^\/api\/admin\/reports\/([^/]+)$/,
    action: 'getReportDetail',
    auth: true,
    payload: (m) => ({ idLaporan: segment(m[1]) }),
  },
  {
    methods: ['POST'],
    path: /^\/api\/admin\/reports\/([^/]+)\/followup$/,
    action: 'saveFollowUp',
    auth: true,
    payload: (m, ctx) => ({ ...ctx.body, idLaporan: segment(m[1]) }),
  },
  {
    methods: ['POST'],
    path: /^\/api\/admin\/reports\/([^/]+)\/evidence$/,
    action: 'uploadEvidence',
    auth: true,
    payload: (m, ctx) => ({ ...ctx.body, idLaporan: segment(m[1]) }),
  },
  {
    methods: ['POST'],
    path: /^\/api\/admin\/reports\/([^/]+)\/classify$/,
    action: 'classifyReport',
    auth: true,
    payload: (m, ctx) => ({ ...ctx.body, idLaporan: segment(m[1]) }),
  },

  // Builder layanan
  { methods: ['GET'], path: /^\/api\/admin\/services$/, action: 'getAdminServices', auth: true },
  { methods: ['POST'], path: /^\/api\/admin\/services$/, action: 'createService', auth: true, payload: bodyPayload },
  {
    methods: ['PUT'],
    path: /^\/api\/admin\/services\/([^/]+)$/,
    action: 'updateService',
    auth: true,
    payload: (m, ctx) => ({ ...ctx.body, idLayanan: segment(m[1]) }),
  },
  {
    methods: ['DELETE'],
    path: /^\/api\/admin\/services\/([^/]+)$/,
    action: 'deleteService',
    auth: true,
    payload: (m) => ({ idLayanan: segment(m[1]) }),
  },

  // Warga, petugas, dan arsip Drive
  { methods: ['GET'], path: /^\/api\/admin\/warga$/, action: 'getWarga', auth: true },
  {
    methods: ['POST', 'PATCH'],
    path: /^\/api\/admin\/warga\/([^/]+)\/verify$/,
    action: 'verifyWarga',
    auth: true,
    payload: (m, ctx) => ({
      idWarga: segment(m[1]),
      statusVerifikasi: ctx.body.statusVerifikasi ?? ctx.body.status,
    }),
  },
  { methods: ['GET'], path: /^\/api\/admin\/petugas$/, action: 'getPetugas', auth: true },
  { methods: ['POST'], path: /^\/api\/admin\/petugas$/, action: 'createPetugas', auth: true, payload: bodyPayload },
  { methods: ['GET'], path: /^\/api\/admin\/drive-tree$/, action: 'getDriveTree', auth: true },

  // Pengumuman
  { methods: ['GET'], path: /^\/api\/admin\/announcements$/, action: 'getAnnouncements', auth: true },
  { methods: ['POST'], path: /^\/api\/admin\/announcements$/, action: 'createAnnouncement', auth: true, payload: bodyPayload },
  {
    methods: ['DELETE'],
    path: /^\/api\/admin\/announcements\/([^/]+)$/,
    action: 'deleteAnnouncement',
    auth: true,
    payload: (m) => ({ idPengumuman: segment(m[1]) }),
  },

  // Pengaturan, log, dan ekspor
  { methods: ['GET'], path: /^\/api\/admin\/settings$/, action: 'getSettings', auth: true },
  { methods: ['PUT'], path: /^\/api\/admin\/settings$/, action: 'saveSettings', auth: true, payload: bodyPayload },
  { methods: ['GET'], path: /^\/api\/admin\/logs$/, action: 'getLogs', auth: true },
  { methods: ['GET'], path: /^\/api\/admin\/export$/, action: 'exportReportCsv', auth: true },

  // Uji koneksi: tidak membawa token dan tidak meneruskan URL uji ke GAS
  { methods: ['POST'], path: /^\/api\/admin\/test-gas$/, action: 'ping' },
];

/** Daftar aksi unik yang dipakai rute di atas. Dipakai oleh tes kontrak. */
export const ROUTE_ACTIONS: string[] = [...new Set(ROUTES.map((route) => route.action))];

export function mapRestToGasCall(
  rawUrl: string,
  method = 'GET',
  bodyObj: Record<string, unknown> = {},
  token?: string | null
): GasCallSpec {
  const upperMethod = method.toUpperCase() as HttpMethod;
  const queryIndex = rawUrl.indexOf('?');
  const pathname = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
  const query = new URLSearchParams(queryIndex === -1 ? '' : rawUrl.slice(queryIndex + 1));
  const ctx: RouteContext = { body: bodyObj, query };

  for (const route of ROUTES) {
    if (!route.methods.includes(upperMethod)) continue;
    const match = pathname.match(route.path);
    if (!match) continue;
    return {
      action: route.action,
      payload: route.payload ? route.payload(match, ctx) : {},
      ...(route.auth && token ? { token } : {}),
    };
  }

  throw new Error(`Endpoint ${upperMethod} ${pathname} belum dipetakan ke Google Apps Script.`);
}
