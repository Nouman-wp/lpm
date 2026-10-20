// The room a host token names. lpm shares in the room its token names, so the
// relay can tell that host from anyone else holding the invite with nothing
// stored, even once it has forgotten the room. Must match room_of in
// desktop/frontend/src-tauri/src/sharerelay.rs.
export async function roomOf(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return btoa(String.fromCharCode(...digest.subarray(0, 16)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
