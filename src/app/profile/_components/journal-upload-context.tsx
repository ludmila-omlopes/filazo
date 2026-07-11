"use client";

import { createContext, useContext } from "react";

export const JournalUploadContext = createContext(false);

export function useJournalUploadPending() {
  return useContext(JournalUploadContext);
}
