// Vultr API v2 response shapes (https://api.vultr.com/v2). Only consumed fields are typed.
// Money is always USD. Lists use cursor pagination. The next cursor lives in `meta.links.next`
// (empty string when there are no more pages).

/** Cursor envelope shared by every paginated list endpoint. */
export interface VultrPaged {
  meta?: { total?: number; links?: { next?: string; prev?: string } };
}

export interface VultrAccountResponse {
  // The balance is wrapped in an `account` object. `balance` can be negative (= account credit).
  account: {
    balance: number;
    pending_charges: number;
    last_payment_date?: string;
    last_payment_amount?: number;
  };
}

export interface VultrInstance {
  id: string;
  label: string;
  main_ip?: string;
  hostname?: string;
  region: string; // region code (e.g. "mex"), not a country
  plan: string; // plan id → priced via /plans
  [key: string]: unknown;
}

export interface VultrInstancesResponse extends VultrPaged {
  instances: VultrInstance[];
}

export interface VultrPlan {
  id: string;
  monthly_cost: number; // USD
  hourly_cost?: number;
  vcpu_count?: number;
  ram?: number;
}

export interface VultrPlansResponse extends VultrPaged {
  plans: VultrPlan[];
}

export interface VultrRegion {
  id: string; // region code, e.g. "sto"
  city?: string;
  country: string; // ISO 3166-1 alpha-2, e.g. "SE"
  continent?: string;
}

export interface VultrRegionsResponse extends VultrPaged {
  regions: VultrRegion[];
}

export interface VultrBillingItem {
  id: number;
  date: string; // ISO timestamp
  type: 'invoice' | 'payment'; // payment = top-up (amount negative), invoice = charge (positive)
  amount: number;
  description: string;
}

export interface VultrBillingResponse extends VultrPaged {
  billing_history: VultrBillingItem[];
}

/** Error body Vultr returns on 4xx/5xx, e.g. an IP not on the key's allowlist. */
export interface VultrError {
  error?: string;
  status?: number;
}
