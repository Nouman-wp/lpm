import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckKokoroInstalled, InstallKokoro, UninstallKokoro } from "../../../bridge/commands";
import { SettingsRow } from "../SettingsRow";
import { BTN_SECONDARY } from "../ui/buttons";
import { Spinner } from "./Spinner";

type KokoroStatus = "checking" | "installed" | "not-installed" | "installing" | "uninstalling";

const KOKORO_DESCRIPTION: Record<KokoroStatus, string> = {
  checking: "Checking...",
  installed: "Installed",
  "not-installed": "Not installed",
  installing: "Installing...",
  uninstalling: "Uninstalling...",
};

export function KokoroEngineRow() {
  const [status, setStatus] = useState<KokoroStatus>("checking");

  useEffect(() => {
    CheckKokoroInstalled()
      .then((ok) => setStatus(ok ? "installed" : "not-installed"))
      .catch(() => setStatus("not-installed"));
  }, []);

  const handleInstall = async () => {
    setStatus("installing");
    try {
      await InstallKokoro();
      setStatus("installed");
      toast.success("Kokoro installed");
    } catch (err) {
      toast.error(`Install failed: ${err}`);
      setStatus("not-installed");
    }
  };

  const handleUninstall = async () => {
    setStatus("uninstalling");
    try {
      await UninstallKokoro();
      setStatus("not-installed");
      toast.success("Kokoro uninstalled");
    } catch (err) {
      toast.error(`Uninstall failed: ${err}`);
      setStatus("installed");
    }
  };

  return (
    <SettingsRow id="tts.kokoro" label="Kokoro Engine" description={KOKORO_DESCRIPTION[status]}>
      {status === "installed" ? (
        <button onClick={handleUninstall} className={BTN_SECONDARY}>Uninstall</button>
      ) : status === "not-installed" ? (
        <button onClick={handleInstall} className={BTN_SECONDARY}>Install</button>
      ) : (
        <Spinner />
      )}
    </SettingsRow>
  );
}
