// Selectel API response shapes (https://docs.selectel.ru/en/api/). Only consumed fields are typed.

export interface SelectelCredentials {
  accountId: string; // account number (Keystone domain name)
  username: string; // service user name
  password: string;
  projectName?: string; // Cloud Platform project; enables cloud (OpenStack) server listing
}

export interface BalancesResponse {
  data?: {
    settings?: { currency?: string };
    billings?: Array<{ final_sum?: number }>;
  };
}

export interface CatalogEndpoint {
  interface?: string;
  region?: string;
  url?: string;
}

export interface CatalogEntry {
  type?: string;
  endpoints?: CatalogEndpoint[];
}

export interface KeystoneAuth {
  token: string;
  catalog: CatalogEntry[];
}

export interface ConsumptionRow {
  value?: number; // kopecks
  period?: string; // naive day start, e.g. "2026-06-01T00:00:00"
}

export interface NovaServer {
  id: string;
  name?: string;
  status?: string;
  created?: string;
  flavor?: { id?: string };
  image?: string | { id?: string };
  addresses?: unknown;
  'OS-EXT-AZ:availability_zone'?: string;
  [key: string]: unknown;
}
