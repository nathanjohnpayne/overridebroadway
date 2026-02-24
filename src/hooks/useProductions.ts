"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToProductions } from "@/lib/firestore";
import type { Production } from "@/types/production";

export function useProductions() {
  const { user } = useAuth();
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProductions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToProductions(user.uid, (prods) => {
      setProductions(prods);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  return { productions, loading };
}
