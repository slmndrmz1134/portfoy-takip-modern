import type { Transaction } from "@portfoy/core";

/** Supabase satırından (snake_case) @portfoy/core Transaction tipine (camelCase) çevirir. */
export function mapDbRowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as number,
    userId: row.user_id as string,
    portfolioId: row.portfolio_id as number,
    symbol: (row.symbol as string) ?? null,
    txType: row.tx_type as Transaction["txType"],
    quantity: (row.quantity as number) ?? null,
    price: (row.price as number) ?? null,
    currency: row.currency as string,
    fxToTry: (row.fx_to_try as number) ?? null,
    cashAmount: (row.cash_amount as number) ?? null,
    fee: (row.fee as number) ?? 0,
    executedAt: row.executed_at as string,
    note: (row.note as string) ?? null,
  };
}
