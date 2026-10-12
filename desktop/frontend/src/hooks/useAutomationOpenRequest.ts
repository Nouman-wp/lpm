import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { jobTargets } from "../jobsFormat";
import { useAutomationOpen, type AutomationOpenRequest } from "../store/automationOpen";
import type { ScheduledJob } from "./useJobs";

function matches(job: ScheduledJob, request: AutomationOpenRequest): boolean {
  if (job.id !== request.id) return false;
  return request.project === null
    ? job.source === "global"
    : jobTargets(job).includes(request.project);
}

// Opens the automation `lpm automations open` asked this view for — a project's
// tab (`host` is the project) or the app-wide page (null) — once the list has
// it. One the list doesn't have yet (added a moment ago) gets one refetch first.
export function useAutomationOpenRequest(
  host: string | null,
  visible: boolean,
  rows: ScheduledJob[] | null,
  refetch: () => Promise<void>,
  onOpen: (job: ScheduledJob, project: string | null) => void,
) {
  const request = useAutomationOpen((s) => s.request);
  const refetched = useRef<{
    request: AutomationOpenRequest;
    rows: ScheduledJob[];
  } | null>(null);

  useEffect(() => {
    if (!visible || request?.host !== host || rows === null) return;
    const job = rows.find((row) => matches(row, request));
    if (!job) {
      if (refetched.current?.request !== request) {
        refetched.current = { request, rows };
        void refetch();
        return;
      }
      if (refetched.current.rows === rows) return;
    }
    useAutomationOpen.getState().clear();
    if (job) onOpen(job, request.project);
    else toast.error(`Couldn't find the automation "${request.id}".`);
  }, [host, visible, request, rows, refetch, onOpen]);
}
