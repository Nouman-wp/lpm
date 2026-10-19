import { initiate } from "./noise.js";

// One encrypted session with the host, through this relay's room for the share.
// Messages are opened strictly in the order they arrive and sealed strictly in the
// order they're sent: each one moves a Noise nonce on.

const KEEPALIVE_MS = 25_000;
const HANDSHAKE_MS = 20_000;

export class ChannelClosed extends Error {
  constructor(code, reason) {
    super(reason || "closed");
    this.code = code;
  }
}

// Resolves once the handshake is done; rejects with ChannelClosed if the relay or
// host turns it away first. `onFrame` gets every frame after that, and `onClose`
// the close code once it ends.
export function connect(invite, { onFrame, onClose }) {
  return new Promise((resolve, reject) => {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${scheme}//${location.host}/room/${invite.room}/guest`);
    ws.binaryType = "arraybuffer";
    let start = null;
    let session = null;
    let ready = false;
    let incoming = Promise.resolve();
    let outgoing = Promise.resolve();
    let keepalive = 0;

    const timer = setTimeout(() => ws.close(4408, "timeout"), HANDSHAKE_MS);

    const channel = {
      get code() {
        return session.code;
      },
      send(frame) {
        outgoing = outgoing
          .then(() => session.seal(JSON.stringify(frame)))
          .then((messages) => {
            if (ws.readyState === WebSocket.OPEN) for (const m of messages) ws.send(m);
          })
          .catch(() => ws.close(4400, "couldn't seal"));
      },
      close() {
        ws.close(1000, "bye");
      },
    };

    ws.onopen = () => {
      keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, KEEPALIVE_MS);
      incoming = incoming.then(async () => {
        start = await initiate(invite.key, invite.room);
        ws.send(start.first);
      });
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") return;
      const bytes = new Uint8Array(event.data);
      incoming = incoming
        .then(async () => {
          if (!session) {
            session = await start.finish(bytes);
            ready = true;
            clearTimeout(timer);
            resolve(channel);
            return;
          }
          const frame = await session.open(bytes);
          if (frame !== null) onFrame(JSON.parse(frame));
        })
        .catch(() => ws.close(4400, "bad message"));
    };

    ws.onclose = (event) => {
      clearTimeout(timer);
      clearInterval(keepalive);
      // Frames already in flight are handled before the close is reported.
      incoming.finally(() => {
        if (ready) onClose(event.code);
        else reject(new ChannelClosed(event.code, event.reason));
      });
    };
  });
}
