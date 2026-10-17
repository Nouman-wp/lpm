import { useCallback, useEffect, useState } from "react";
import { MACHINE } from "../../../machineWords";
import { peerSlugOf } from "../../../peer/markers";
import { peerAlias, usePeerState, type PeerClient } from "../../../peer/usePeerState";
import type { JobInfo } from "../../../jobsFormat";

const THIS_MACHINE = "";

export interface JobHost {
  /// The paired machine the job runs on, by slug; undefined = this Mac.
  host: string | undefined;
  peer: PeerClient | undefined;
  /// The machines a job can be put on, "" standing for this Mac. Only the one
  /// it is on while editing: a job's runs and history stay where it ran.
  options: { value: string; label: string }[];
  /// Whether there is another machine to put a job on at all.
  shown: boolean;
  setHost: (host: string | undefined) => void;
  /// Whether `name` is a project on the job's machine.
  onHost: (name: string) => boolean;
}

// Which machine the job being edited lives on, or a new job will: the one its
// project is on, else this Mac until another is picked.
export function useJobHost(
  open: boolean,
  editing: { project: string; job: JobInfo } | null,
  newProject: string | undefined,
): JobHost {
  const { state } = usePeerState();
  const [host, setHost] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const project = editing?.project ?? newProject;
    setHost(editing?.job.host ?? (project ? (peerSlugOf(project) ?? undefined) : undefined));
  }, [open, editing, newProject]);

  const onHost = useCallback((name: string) => (peerSlugOf(name) ?? undefined) === host, [host]);

  const machines = [
    { value: THIS_MACHINE, label: MACHINE.ThisMachineTitle },
    ...state.peers
      .filter((p) => p.connected || p.slug === host)
      .map((p) => ({ value: p.slug, label: peerAlias(state.peers, p.slug) })),
  ];
  return {
    host,
    peer: host ? state.peers.find((p) => p.slug === host) : undefined,
    options: editing ? machines.filter((m) => m.value === (host ?? THIS_MACHINE)) : machines,
    shown: machines.length > 1,
    setHost,
    onHost,
  };
}
