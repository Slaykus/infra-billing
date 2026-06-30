// ISPsystem BILLmanager CGI API shapes. Responses are wrapped in `doc`,
// scalars rendered as { "$": "value" } (and sometimes arrays of them).

export interface BillmgrCredentials {
  baseUrl: string; // CGI URL, e.g. https://my.akenai.host/billmgr
  username: string;
  password: string;
  totpSecret?: string; // base32 seed for OTP 2FA, lets us generate the one-time code
}

export interface BillmgrDoc {
  doc?: {
    auth?: { $id?: string };
    session?: { $id?: string };
    user?: Record<string, unknown>;
    elem?: unknown;
    error?: unknown;
    ok?: unknown; // present (instead of data) when a func redirects, e.g. a 2FA confirm form
    [key: string]: unknown;
  };
}
