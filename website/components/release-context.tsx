"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ReleaseInfo } from "@/lib/release-info";

const ReleaseContext = createContext<ReleaseInfo>({
  release: null,
  downloads: null,
});

export function ReleaseProvider({
  value,
  children,
}: {
  value: ReleaseInfo;
  children: ReactNode;
}) {
  return <ReleaseContext value={value}>{children}</ReleaseContext>;
}

export function useRelease(): ReleaseInfo {
  return useContext(ReleaseContext);
}
