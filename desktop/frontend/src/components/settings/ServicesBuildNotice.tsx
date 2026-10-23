import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RestartServices, ServicesBuild } from "../../../bridge/commands";
import { BTN_SECONDARY } from "../ui/buttons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Spinner } from "./Spinner";

interface Build {
  running?: boolean;
  projects?: number;
  version?: string;
  current?: boolean;
}

// Settings › General › Updates: services still on the lpm from before an
// update, with the restart that moves them onto this one.
export function ServicesBuildNotice({ appVersion }: { appVersion: string }) {
  const [build, setBuild] = useState<Build | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    ServicesBuild().then(setBuild, () => {});
  }, []);

  if (!build?.running || build.current) return null;

  const restart = async () => {
    setConfirming(false);
    setRestarting(true);
    try {
      await RestartServices();
      toast.success(`Services restarted on lpm ${appVersion}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setRestarting(false);
      setBuild(await ServicesBuild().catch(() => null));
    }
  };

  const projects = build.projects ?? 1;
  const where = projects === 1 ? "1 project" : `${projects} projects`;
  const running = build.version ? `lpm ${build.version}` : "an older lpm";
  return (
    <>
      <div
        data-settings-row="general.servicesBuild"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-[var(--accent-amber)]/8 px-4 py-2.5"
      >
        <p className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-primary)]">
          <TriangleAlert size={13} className="shrink-0 text-[var(--accent-amber)]" />
          {restarting ? "Restarting services..." : `Services in ${where} still run on ${running}.`}
        </p>
        <button onClick={() => setConfirming(true)} disabled={restarting} className={BTN_SECONDARY}>
          {restarting ? <Spinner /> : "Restart services"}
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Restart all services?"
        confirmLabel="Restart services"
        body={`Services keep running through an update, so these are still on ${running}. Every running service stops and starts again on lpm ${appVersion}. Terminals and agents aren't affected.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void restart()}
      />
    </>
  );
}
