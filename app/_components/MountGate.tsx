"use client";
import { useEffect, useState, type ReactNode } from "react";

export default function MountGate({ children, delayMs = 0 }: { children: ReactNode; delayMs?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (delayMs > 0) {
      const id = setTimeout(() => setMounted(true), delayMs);
      return () => clearTimeout(id);
    }
    setMounted(true);
  }, [delayMs]);
  if (!mounted) return null;
  return <>{children}</>;
}
