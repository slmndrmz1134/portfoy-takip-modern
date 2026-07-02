"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PERIODS, type PeriodKey } from "@/lib/periods";

export function PeriodSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("period") as PeriodKey) || "ALL";

  function handleSelect(key: PeriodKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", key);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="period-selector">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          className={`period-btn ${current === p.key ? "active" : ""}`}
          onClick={() => handleSelect(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

