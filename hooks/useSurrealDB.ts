import { useEffect, useState, useCallback } from "react";
import { surrealDB } from "@/lib/surrealdb-client";

export function useSurrealDB() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wrapper to trigger connection manually if needed
  const connect = useCallback(async () => {
    // If global singleton is already connected, just update local state and return
    if (surrealDB.getConnectionStatus()) {
      setIsConnected(true);
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      await surrealDB.connect();
      setIsConnected(true);
    } catch (err: any) {
      console.error("Hook connection error:", err);
      setError(err.message || "Failed to connect to SurrealDB");
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Wrapper to disconnect manually (e.g. logout button)
  const disconnect = useCallback(async () => {
    try {
      await surrealDB.disconnect();
      setIsConnected(false);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect from SurrealDB");
    }
  }, []);

  // Lightweight check to sync UI state with Singleton state
  const refreshConnectionState = useCallback(() => {
    const status = surrealDB.getConnectionStatus();
    setIsConnected(status);
    return status;
  }, []);

  useEffect(() => {
    // 1. Attempt connection on mount
    connect();

    // 2. Poll the Singleton status to keep UI in sync
    // The Singleton handles the actual "Heartbeat/Reconnect" logic internally.
    // This interval just ensures the React State (and your UI badges) know about it.
    const interval = setInterval(() => {
      refreshConnectionState();
    }, 2000); // Check every 2 seconds

    return () => {
      clearInterval(interval);
      // CRITICAL: We do NOT call disconnect() here anymore.
      // This ensures the connection survives page navigation and hot reloads.
    };
  }, [connect, refreshConnectionState]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    refreshConnectionState,
  };
}