import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RestartServices, ServicesBuild } from "../../../bridge/commands";
import { rowProps } from "../../settings-registry";
import { SettingsRow } from "../SettingsRow";
import { BTN_SECONDARY } from "../ui/buttons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Spinner } from "./Spinner";

interface Build {
  running?: boolean;
  version?: string;
  current?: boolean;
}

// Settings › General › About: shown only while services still run on the lpm
// from before an update, with the restart that moves them onto this one.
export function ServicesBuildRow({ appVersion }: { appVersion: string }) {
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

  const running = build.version ? `lpm ${build.version}` : "an older lpm";
  return (
    <>
      <SettingsRow
        {...rowProps("general.servicesBuild", {
          description: restarting ? "Restarting services..." : `Still running on ${running}`,
        })}
        details={
          <>
            <p>
              Services keep running through an update, so your dev servers don't go down. That
              leaves them on the version they started on until they stop.
            </p>
            <p>Restart them to run them on lpm {appVersion}.</p>
          </>
        }
      >
        <button onClick={() => setConfirming(true)} disabled={restarting} className={BTN_SECONDARY}>
          {restarting ? <Spinner /> : "Restart"}
        </button>
      </SettingsRow>
      <ConfirmDialog
        open={confirming}
        title="Restart all services?"
        confirmLabel="Restart services"
        body={`Every running service stops and starts again on lpm ${appVersion}. Terminals and agents aren't affected.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void restart()}
      />
    </>
  );
}
