import type { Metadata } from "next";
import { JoinSharedTab } from "./_components/join-shared-tab";

export const metadata: Metadata = {
  title: "Join a shared tab",
  description: "Open a terminal tab someone shared with you in lpm.",
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return <JoinSharedTab />;
}
