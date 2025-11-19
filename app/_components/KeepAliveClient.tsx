"use client";
import { useEffect } from "react";
import { startKeepAlive } from "../../lib/keepAlive";

export default function KeepAliveClient() {
  useEffect(() => {
    const stop = startKeepAlive();
    return () => stop();
  }, []);
  return null;
}
