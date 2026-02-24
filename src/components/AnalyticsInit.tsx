"use client";
import { useEffect } from "react";
import { getFirebaseAnalytics } from "@/lib/firebase";

export default function AnalyticsInit() {
  useEffect(() => {
    getFirebaseAnalytics();
  }, []);
  return null;
}
