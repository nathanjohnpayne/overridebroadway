"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToProductions } from "@/lib/firestore";
import type { Production } from "@/types/production";

export function useProductions() {
  const { user } = useAuth();
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setProductions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToProductions(
      user.uid,
      (prods) => {
        setProductions(prods);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load productions:", err);
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  return { productions, loading, error };
}
