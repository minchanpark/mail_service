"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { BackendAdapter } from "@/lib/client/http-backend";

const BackendContext = createContext<BackendAdapter | null>(null);

export function BackendProvider({
  adapter,
  children,
}: {
  adapter: BackendAdapter;
  children: ReactNode;
}) {
  return <BackendContext.Provider value={adapter}>{children}</BackendContext.Provider>;
}

export function useBackend() {
  const backend = useContext(BackendContext);
  if (!backend) {
    throw new Error("useBackend must be used within BackendProvider");
  }

  return backend;
}
