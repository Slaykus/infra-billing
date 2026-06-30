// 4VPS.SU API response shapes (https://4vps.su/page/api). Only consumed fields are typed.
// Every response is wrapped in { error, data }.

export interface FourVpsCredentials {
  token: string; // Bearer API key (dashboard → /dashboard/api)
  panelId?: string; // billing panel id (panel_id param); defaults to "1"
}

export interface ApiResponse<T> {
  error: boolean;
  data: T;
}

export interface FourVpsServer {
  id: number;
  name?: string;
  tname?: string; // tariff/server display name, e.g. "USA-cx01"
  price?: number; // monthly price in RUB
  dc?: number; // datacenter id (→ country via getDcList)
  image?: string; // OS name
  cpu?: number;
  mem?: number;
  disk?: number;
  ipv4?: string;
  status?: string; // "active" | ...
  expired?: number; // unix seconds, next billing date
  autoprolong?: number;
  deleted?: number; // 1 = removed
  [key: string]: unknown;
}

export interface Datacenter {
  id: number;
  flag?: string; // ISO 3166-1 alpha-2 (lowercase), e.g. "ae"
  dc_name?: string;
}
