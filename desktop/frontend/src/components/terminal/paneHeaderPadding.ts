// A fullscreen pane covers the whole window, so on macOS its tab strip starts
// past the traffic lights (tauri.conf trafficLightPosition). Native fullscreen
// hides them, and Linux/Windows keep the OS title bar.
export function paneHeaderPadding(
  paneFullscreen: boolean,
  mac: boolean,
  windowFullscreen: boolean,
): string {
  return paneFullscreen && mac && !windowFullscreen ? "pl-20 pr-2" : "px-2";
}
