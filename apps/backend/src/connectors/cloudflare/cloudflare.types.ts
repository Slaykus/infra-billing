export interface CloudflareCredentials {
  accountId: string; // CF account id; both endpoints are account-scoped
  apiToken: string; // Bearer; perms: Account → Domain Configuration:Read + Account → Billing:Read
}

export interface CfEnvelope<T> {
  success: boolean;
  result: T;
  errors?: unknown[];
  // registrar lists paginate with total_pages; billing/history uses a next_page boolean.
  result_info?: {
    page?: number;
    per_page?: number;
    total_count?: number;
    total_pages?: number;
    next_page?: boolean;
  };
}

export interface CfDomain {
  name: string;
  current_registrar?: string;
  registry?: string;
  expires_at?: string;
  auto_renew?: boolean;
  last_known_status?: string;
}

export interface CfBillingItem {
  id: string;
  type: 'invoice' | 'payment';
  occurred_at: string;
  amount: number;
  currency: string;
  receipt_id?: string;
  status?: string;
  source?: string;
}
