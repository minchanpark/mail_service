"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { MailApiService } from "@/services/api/mail-api-service";

const MailServiceContext = createContext<MailApiService | null>(null);

export function MailServiceProvider({
  service,
  adapter,
  children,
}: {
  service?: MailApiService;
  adapter?: MailApiService;
  children: ReactNode;
}) {
  const resolvedService = service ?? adapter;

  if (!resolvedService) {
    throw new Error("MailServiceProvider requires a service instance.");
  }

  return <MailServiceContext.Provider value={resolvedService}>{children}</MailServiceContext.Provider>;
}

export function useMailService() {
  const service = useContext(MailServiceContext);
  if (!service) {
    throw new Error("useMailService must be used within MailServiceProvider");
  }

  return service;
}

export function BackendProvider({
  adapter,
  children,
}: {
  adapter: MailApiService;
  children: ReactNode;
}) {
  return <MailServiceProvider service={adapter}>{children}</MailServiceProvider>;
}

export const useBackend = useMailService;
