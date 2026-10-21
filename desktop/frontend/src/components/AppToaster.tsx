import { Toaster } from "sonner";
import { useToastOffset } from "../hooks/useToastOffset";
import { FOOTER_TOASTER_ID, FOOTER_TOASTER_OFFSET } from "../toasterOffset";

export function AppToaster({ theme, dockInset }: { theme: "light" | "dark"; dockInset: number }) {
  const offset = useToastOffset(dockInset);
  return (
    <>
      <Toaster
        position="bottom-right"
        theme={theme}
        offset={offset}
        closeButton
        richColors
        toastOptions={{ duration: 5000 }}
      />
      <Toaster
        id={FOOTER_TOASTER_ID}
        position="bottom-left"
        theme={theme}
        offset={FOOTER_TOASTER_OFFSET}
        closeButton
        richColors
      />
    </>
  );
}
