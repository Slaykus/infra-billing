// VDSina Public API response shapes (https://userapi.vdsina.ru). Only consumed fields are typed.

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

export interface VdsinaServer {
  id: number;
  name?: string;
  host?: string;
  ip?: string | VdsinaServerIp[];
  status?: string;
  status_text?: string;
  created?: string;
  expire?: string;
  expires?: string;
  end?: string;
  prolong?: string;
  autoprolong?: boolean;
  datacenter?: VdsinaNamedRef;
  'server-plan'?: VdsinaServerPlan;
  server_plan?: VdsinaServerPlan;
  'server-group'?: VdsinaNamedRef;
  server_group?: VdsinaNamedRef;
  template?: VdsinaNamedRef;
  // detail response: per-parameter { value: plan base, total: configured } pairs (cpu/ram/disk)
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VdsinaServerPlan {
  id?: number;
  name?: string;
  cost?: number | string;
  period?: string;
  period_name?: string;
  has_params?: boolean;
  'server-group'?: number;
  server_group?: number;
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
