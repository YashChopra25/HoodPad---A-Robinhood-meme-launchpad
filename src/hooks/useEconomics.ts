"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ECONOMICS, readEconomics } from "@/lib/factory";
import type { Economics } from "@/lib/types";

/**
 * Launch fees and curve parameters. Reads them off the factory when one is
 * configured so the create form quotes exactly what the contract will charge,
 * and falls back to the compiled-in defaults otherwise.
 */
export function useEconomics(): { economics: Economics; loading: boolean } {
  const [economics, setEconomics] = useState<Economics>(DEFAULT_ECONOMICS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void readEconomics()
      .then((value) => {
        if (!cancelled) setEconomics(value);
      })
      .catch(() => {
        // Falls through to the defaults already in state.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { economics, loading };
}
