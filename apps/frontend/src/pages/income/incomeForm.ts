export interface IForm {
  amount: string;
  currency: string;
  incomeDate: string;
  description: string;
}

export const toIso = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toISOString() : undefined);
