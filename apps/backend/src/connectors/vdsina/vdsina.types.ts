// VDSina Public API response shapes (https://userapi.vdsina.ru). Only consumed fields are typed.

// Two official branches serve a byte-identical API (same OpenAPI spec); the branch fixes the
// billing currency, which never appears in responses. Keys are the only accepted base URLs.
export const VDSINA_BASE_URLS: Record<string, string> = {
  'https://userapi.vdsina.ru': 'RUB',
  'https://userapi.vdsina.com': 'USD',
};

export interface VdsinaCredentials {
  token: string;
  baseUrl?: string; // one of VDSINA_BASE_URLS keys; default — the .ru branch
}

export interface VdsinaEnvelope<T> {
  status: 'ok' | 'error' | string;
  status_msg?: string;
  status_code?: number;
  description?: string;
  data: T;
}

export interface VdsinaBalance {
  real?: number | string;
  bonus?: number | string;
  partner?: number | string;
}

// Field shapes verified live (2026-07, .com branch): list rows carry `end` and a bare
// `server-plan` {id, name}; `ip` is a single object in list responses.
export interface VdsinaServer {
  id: number;
  name?: string;
  host?: string;
  ip?: string | VdsinaServerIp | VdsinaServerIp[];
  status?: string;
  status_text?: string;
  created?: string;
  end?: string;
  autoprolong?: boolean;
  datacenter?: VdsinaNamedRef;
  'server-plan'?: VdsinaServerPlan;
  'server-group'?: VdsinaNamedRef;
  template?: VdsinaNamedRef;
  // detail response: per-parameter { value: plan base, total: configured } pairs (cpu/ram/disk)
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VdsinaServerPlan {
  id?: number;
  name?: string;
  cost?: number | string; // plan cost with client discounts (full_cost = undiscounted)
  period?: string;
  has_params?: boolean;
  'server-group'?: number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VdsinaNamedRef {
  id?: number;
  name?: string;
  country?: string;
  [key: string]: unknown;
}

export interface VdsinaServerIp {
  id?: number;
  ip?: string;
  type?: string;
  host?: string;
  gateway?: string;
  netmask?: string;
  mac?: string;
}

export interface VdsinaOperation {
  id: number;
  purse?: string;
  type: 1 | -1 | number;
  status: 0 | 1 | number;
  summ: string | number;
  created?: string;
  updated?: string;
  comment?: string;
  payment?: {
    type?: string;
    name?: string;
  } | null;
  service?: {
    id?: number;
  } | null;
  paylink?: string | null;
}
