"use client";
import { createContext, useContext } from "react";
import type { AdminAccess } from "./types";
export const AdminActorContext = createContext<AdminAccess | null>(null);
export function useAdminActor() {
  return useContext(AdminActorContext);
}
