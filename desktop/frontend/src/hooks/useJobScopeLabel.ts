import { useCallback, useMemo } from "react";
import { jobScopeLabel } from "../jobsList";
import { rowMachinesLabel } from "../jobsMachines";
import { machineChoices } from "../peer/machineChoices";
import { peerSlugOf } from "../peer/markers";
import { peerAlias, type PeerStateShape } from "../peer/usePeerState";
import type { ScheduledJob } from "./useJobs";
import type { ProjectInfo } from "../types";

// A job's scope is counted against its own machine's projects, and a paired
// machine's job says which machine it runs on — or, once the job names the
// computers it runs on and there's more than one to name, those.
export function useJobScopeLabel(
  projects: ProjectInfo[],
  projectLabel: (name: string) => string,
  peerState: PeerStateShape,
): (job: ScheduledJob) => string {
  const choices = useMemo(() => machineChoices(peerState), [peerState]);
  return useCallback(
    (job: ScheduledJob) => {
      const onMachine = projects.filter((p) => (peerSlugOf(p.name) ?? undefined) === job.host);
      const scope = jobScopeLabel(job, onMachine.length, projectLabel);
      const myId = peerState.host.hostId;
      const where =
        choices.length > 1 || job.machines?.some((m) => m.id !== myId)
          ? rowMachinesLabel(job, myId, (id) => choices.find((c) => c.id === id)?.label)
          : null;
      if (where) return `${scope} · ${where}`;
      return job.host ? `${scope} · ${peerAlias(peerState.peers, job.host)}` : scope;
    },
    [projects, projectLabel, peerState.peers, peerState.host.hostId, choices],
  );
}
