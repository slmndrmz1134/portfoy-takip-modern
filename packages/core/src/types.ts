// Paylaşılan tip tanımları — web + mobil aynı tipleri kullanır.

export type Market = "US" | "BIST" | "FX" | "GOLD";
export type InstrumentType = "STOCK" | "CURRENCY" | "GOLD";
export type TxType = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW" | "DIVIDEND" | "FEE";

export interface Instrument {
  symbol: string;
  name: string;
  market: Market;
  type: InstrumentType;
  currency: string; // fiyatın ifade edildiği para birimi
}

export interface Transaction {
  id: number;
  userId: string;
  portfolioId: number;
  symbol: string | null;
  txType: TxType;
  quantity: number | null;
  price: number | null;
  currency: string;
  fxToTry: number | null;
  cashAmount: number | null;
  fee: number;
  executedAt: string; // ISO timestamp
  note: string | null;
}

export interface PricePoint {
  symbol: string;
  price: number;
  currency: string;
  source: string;
  isStale: boolean;
  asOf: string; // ISO timestamp
}

export interface FxRate {
  pair: string; // "USDTRY"
  rate: number;
  source: string;
  asOf: string;
}

export interface PortfolioValuation {
  id: number;
  userId: string;
  portfolioId: number | null; // null = COMPOSITE
  ts: string;
  totalValueTry: number;
  totalValueUsd: number;
  netCashFlowTry: number;
  usdTryRate: number;
}

/** Bir varlığın türetilmiş anlık pozisyonu (transactions'tan hesaplanır). */
export interface Holding {
  symbol: string;
  quantity: number;
  /** FIFO'ya göre kalan lotların toplam maliyeti (TRY). */
  costBasisTry: number;
  currency: string;
}

/** FIFO maliyet takibi için tek bir alış lotu. */
export interface Lot {
  quantity: number;
  unitCostTry: number; // lot alınırken TRY cinsinden birim maliyet
  acquiredAt: string;
}
