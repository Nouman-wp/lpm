import { useEffect, useState } from "react";
import { toast } from "../../notifications/toast";
import { useConfirmFlash } from "../../hooks/useConfirmFlash";
import { SettingsRow } from "../SettingsRow";
import { BTN_SECONDARY } from "../ui/buttons";
import { ConfirmNote } from "../ui/ConfirmNote";
import { useSettingsTarget } from "./settingsTarget";
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
  const { commands } = useSettingsTarget();
  const [status, setStatus] = useState<KokoroStatus>("checking");
  const [confirmed, flashConfirmed] = useConfirmFlash();

  useEffect(() => {
    commands
      .kokoroInstalled()
      .then((ok) => setStatus(ok ? "installed" : "not-installed"))
      .catch(() => setStatus("not-installed"));
  }, [commands]);

  const handleInstall = async () => {
    setStatus("installing");
    try {
      await commands.installKokoro();
      setStatus("installed");
      flashConfirmed();
    } catch (err) {
      toast.error(`Install failed: ${err}`);
      setStatus("not-installed");
    }
  };

  const handleUninstall = async () => {
    setStatus("uninstalling");
    try {
      await commands.uninstallKokoro();
      setStatus("not-installed");
      flashConfirmed();
    } catch (err) {
      toast.error(`Uninstall failed: ${err}`);
      setStatus("installed");
    }
  };

  return (
    <SettingsRow id="tts.kokoro" label="Kokoro Engine" description={KOKORO_DESCRIPTION[status]}>
      {confirmed ? (
        <ConfirmNote>{status === "installed" ? "Installed" : "Uninstalled"}</ConfirmNote>
      ) : status === "installed" ? (
        <button onClick={handleUninstall} className={BTN_SECONDARY}>Uninstall</button>
      ) : status === "not-installed" ? (
        <button onClick={handleInstall} className={BTN_SECONDARY}>Install</button>
      ) : (
        <Spinner />
      )}
    </SettingsRow>
  );
}
