import { fetchAuthSession } from 'aws-amplify/auth';

// Base URL of the read-only PanelApi (from SAM outputs). Trailing slash is
// trimmed so callers can always use absolute-style paths like `/leads`.
const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const BASE = RAW_BASE.replace(/\/+$/, '');

export type Estado =
  | 'nuevo'
  | 'contactado'
  | 'interesado'
  | 'cerrado'
  | 'perdido';

export interface MensajeHistorial {
  de?: 'cliente' | 'vendedor' | string;
  texto: string;
  en: string;
  por?: string;
}

export interface Lead {
  leadId: string;
  nombre: string;
  telefono: string;
  mensaje?: string;
  anuncioOrigen?: string;
  canal?: string;
  vendedorId?: string;
  estado: Estado | string;
  creadoEn: string;
  ultimoMensaje?: string;
  ultimoMensajeEn?: string;
  historial?: MensajeHistorial[];
}

export interface Vendedor {
  vendedorId: string;
  nombre: string;
  telefono?: string;
  activo?: boolean;
  orden?: number;
}

export interface VendedorStat {
  vendedorId: string;
  total: number;
}

export interface Stats {
  total: number;
  porVendedor: VendedorStat[];
}

/**
 * Build the Authorization header from the current Cognito session. The panel is
 * read-only and always authenticated via the Amplify <Authenticator>, so a
 * missing id token is an unexpected/expired-session case.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error('Sesión no autenticada o expirada.');
  }
  return { Authorization: `Bearer ${idToken}` };
}

async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al consultar ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * Defensive unwrap: the read API may return a bare array or wrap it under a
 * common envelope key. This keeps the panel resilient to either shape.
 */
function toArray<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const k of ['items', ...keys]) {
      if (Array.isArray(obj[k])) return obj[k] as T[];
    }
  }
  return [];
}

export async function getLeads(vendedorId?: string): Promise<Lead[]> {
  const q =
    vendedorId && vendedorId.length > 0
      ? `?vendedorId=${encodeURIComponent(vendedorId)}`
      : '';
  const data = await apiGet<unknown>(`/leads${q}`);
  return toArray<Lead>(data, 'leads');
}

export async function getVendedores(): Promise<Vendedor[]> {
  const data = await apiGet<unknown>('/vendedores');
  return toArray<Vendedor>(data, 'vendedores');
}

export async function getStats(): Promise<Stats> {
  const data = await apiGet<Record<string, unknown>>('/stats');
  // La API (lambda/api/index.mjs) responde:
  //   { totalLeads, porVendedor: {vendedorId: count}, porEstado, nombresVendedor }
  // Aceptamos también { total, porVendedor: [...] } de forma defensiva.
  const total =
    typeof data?.totalLeads === 'number'
      ? (data.totalLeads as number)
      : typeof data?.total === 'number'
        ? (data.total as number)
        : 0;

  const pv = data?.porVendedor;
  let porVendedor: VendedorStat[] = [];
  if (Array.isArray(pv)) {
    porVendedor = pv as VendedorStat[];
  } else if (pv && typeof pv === 'object') {
    porVendedor = Object.entries(pv as Record<string, number>).map(
      ([vendedorId, count]) => ({ vendedorId, total: Number(count) || 0 })
    );
  }
  return { total, porVendedor };
}

export async function responderLead(
  leadId: string,
  texto: string
): Promise<{ ok: boolean; entrada: MensajeHistorial; estado: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/responder`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ leadId, texto }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.message === 'string'
        ? data.message
        : `Error ${res.status} al enviar la respuesta`;
    throw new Error(msg);
  }
  return data;
}
