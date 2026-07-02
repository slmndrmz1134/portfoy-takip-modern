export const PERIODS = [
  { key: "1W", label: "1H" },
  { key: "1M", label: "1A" },
  { key: "3M", label: "3A" },
  { key: "6M", label: "6A" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
  { key: "ALL", label: "Tümü" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

/** Period anahtarına göre filtreleme başlangıç tarihini döndürür. */
export function getPeriodStartDate(period: PeriodKey): Date {
  const now = new Date();
  switch (period) {
    case "1W":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "1M":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3M":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "6M":
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case "1Y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "YTD":
      return new Date(now.getFullYear(), 0, 1);
    case "ALL":
    default:
      return new Date(0);
  }
}
