"use client";

import { Cloud, Folder, LaptopMinimal, Server, Smartphone } from "lucide-react";
import { MenuCloseButton } from "./ui-kit";
import { SourceOption } from "./source-option";

export type ProjectSource = "local" | "clone" | "server" | "computer" | "phone";

const SECTION_LABEL =
  "px-4 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#919191]";

// The root of the app's NewProjectPicker: sources on this Mac, then the
// machines lpm reaches out to.
export function ProjectSourcePicker({
  onPick,
  onClose,
}: {
  onPick: (source: ProjectSource) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-labelledby="add-project-title"
      className="relative max-h-full w-[360px] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] py-1.5 shadow-2xl"
    >
      <MenuCloseButton onClick={onClose} />
      <div className="px-2 pb-1 pt-3.5">
        <p
          id="add-project-title"
          className="px-4 text-[13px] font-medium text-[#e5e5e5]"
        >
          Add a project
        </p>
        <div className="mt-1 flex flex-col">
          <p className={SECTION_LABEL}>On this Mac</p>
          <SourceOption
            icon={<Folder size={22} strokeWidth={1.5} />}
            color="#facc15"
            label="Local Folder"
            desc="Pick a folder on disk"
            onClick={() => onPick("local")}
            tourTarget="source-local"
          />
          <SourceOption
            icon={<Cloud size={22} strokeWidth={2} />}
            color="#a78bfa"
            label="Clone Repository"
            desc="Clone from a Git repo URL into a local folder"
            onClick={() => onPick("clone")}
          />
          <div className="mx-4 mt-2 h-px bg-[#2e2e2e]" />
          <p className={SECTION_LABEL}>Remote</p>
          <SourceOption
            icon={<Server size={22} strokeWidth={1.5} />}
            color="#22d3ee"
            label="Server"
            desc="Set it up as a Linux host for many projects, or open one folder over SSH"
            onClick={() => onPick("server")}
            tourTarget="source-server"
            drills
          />
          <SourceOption
            icon={<LaptopMinimal size={22} strokeWidth={1.5} />}
            color="#4ade80"
            label="Another computer"
            desc="A Mac or PC running lpm — open its projects here"
            onClick={() => onPick("computer")}
            drills
          />
          <SourceOption
            icon={<Smartphone size={22} strokeWidth={1.5} />}
            color="#60a5fa"
            label="Phone"
            desc="Control your projects from lpm Link on iPhone or iPad"
            onClick={() => onPick("phone")}
            drills
          />
        </div>
      </div>
    </div>
  );
}
