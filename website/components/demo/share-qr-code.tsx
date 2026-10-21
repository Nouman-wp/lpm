const SIZE = 25;
const FINDER = 7;

function isFinder(x: number, y: number): boolean {
  const corner = (cx: number, cy: number) =>
    x >= cx && x < cx + FINDER && y >= cy && y < cy + FINDER;
  return corner(0, 0) || corner(SIZE - FINDER, 0) || corner(0, SIZE - FINDER);
}

function finderCell(x: number, y: number): boolean {
  const lx = x >= SIZE - FINDER ? x - (SIZE - FINDER) : x;
  const ly = y >= SIZE - FINDER ? y - (SIZE - FINDER) : y;
  const ring = Math.max(Math.abs(lx - 3), Math.abs(ly - 3));
  return ring !== 2;
}

// The code's look without a code in it: a demo link has nothing to open, so
// there is nothing for a camera to read.
function modules(seed: string): [number, number][] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const on: [number, number][] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (isFinder(x, y)) {
        if (finderCell(x, y)) on.push([x, y]);
        continue;
      }
      const nearFinder =
        (x <= FINDER && y <= FINDER) ||
        (x >= SIZE - FINDER - 1 && y <= FINDER) ||
        (x <= FINDER && y >= SIZE - FINDER - 1);
      if (nearFinder) continue;
      h = Math.imul(h ^ (x * 31 + y), 16777619);
      if ((h >>> 13) & 1) on.push([x, y]);
    }
  }
  return on;
}

// Ports the app's ShareQrCode: the share link for a phone's camera.
export function ShareQrCode({ seed }: { seed: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[10px] bg-[#242424] p-3">
      <svg
        role="img"
        aria-label="QR code for the share link"
        viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`}
        className="h-[132px] w-[132px] shrink-0 rounded-md bg-white"
        shapeRendering="crispEdges"
      >
        {modules(seed).map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111" />
        ))}
      </svg>
      <p className="text-xs leading-relaxed text-[#b3b3b3]">
        Point a phone&apos;s camera here. The tab opens in its browser, with nothing to install.
      </p>
    </div>
  );
}
