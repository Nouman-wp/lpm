import { AppStoreQr } from "./app-store-qr";

// The App Store badge only helps on the phone itself; someone reading on a
// computer gets there by pointing the iPhone camera at this code.
export function AppStoreScan({ className = "" }: { className?: string }) {
  return (
    <div
      className={`hidden items-center gap-3 rounded-2xl border border-gray-200 bg-white py-2 pl-2 pr-4 text-left md:flex dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
    >
      <AppStoreQr className="h-[60px] w-[60px] shrink-0 rounded-lg" />
      <span>
        <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">
          On a computer?
        </span>
        <span className="block max-w-[11rem] text-[12px] leading-snug text-gray-500 dark:text-gray-400">
          Scan with your iPhone camera to open lpm Link.
        </span>
      </span>
    </div>
  );
}
