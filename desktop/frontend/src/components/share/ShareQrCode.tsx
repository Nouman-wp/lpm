import { useEffect, useState } from "react";
import { PeerShareQr } from "../../../bridge/commands";

// The share link for a phone's camera. The SVG is drawn on this machine from
// the link alone.
export function ShareQrCode({ link }: { link: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void PeerShareQr(link)
      .then((drawn) => {
        if (live) setSvg(drawn);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [link]);

  return (
    <div className="flex items-center gap-4 rounded-[10px] bg-[var(--bg-secondary)] p-3">
      <div
        aria-label="QR code for the share link"
        role="img"
        className="h-[132px] w-[132px] shrink-0 overflow-hidden rounded-md bg-white [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        Point a phone's camera here. The tab opens in its browser, with nothing to install.
      </p>
    </div>
  );
}
