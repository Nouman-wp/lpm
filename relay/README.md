# lpm share relay

Lets someone join a tab shared in lpm from a browser, with nothing to install.
A Cloudflare Worker with one Durable Object per shared tab, plus the page the
guest joins from, served at `https://lpm-share-relay.lpm-share-relay.workers.dev`.

## How it works

- While a tab is shared, lpm on the sharing machine keeps one WebSocket open to
  `/room/<room>/host` (`sharerelay.rs`), claiming the room with a token only it
  holds. The room id and the share's public key travel in the invite's URL
  fragment, which never reaches any server.
- A browser opens the invite at `https://lpm-share-relay.lpm-share-relay.workers.dev/#<invite>` and connects to
  `/room/<room>/guest`. The room tells the host, and from then on forwards
  messages between them, tagged with an 8-byte id per guest.
- Each guest runs a Noise NK handshake with the host (`public/noise.js` and
  `sharenoise.rs`; `test/noise-vector.json` pins both to the same bytes). The
  relay only ever sees ciphertext. Both ends show four digits derived from the
  handshake, and the host compares them before letting the guest in.
- After that the guest speaks the same protocol as a guest in lpm, under the
  same rules (`peer/guest.rs`): one terminal, view only until the host allows
  typing.
- Rooms hibernate, so an idle share costs nothing. A room whose host never comes
  back is deleted after 24 hours.

## Develop

```sh
npm install
npm run dev     # the relay and page at http://localhost:8787
npm test        # Noise against the host's test vector
npm run typecheck
```

Point a development build of lpm at it with `LPM_SHARE_RELAY=http://localhost:8787`
(`LPM_SHARE_RELAY=off` keeps shares on the network only).

## Deploy

```sh
npx wrangler login
npm run deploy
```

It runs on the account's free `workers.dev` address. lpm.cx's DNS is on Vercel,
and a custom domain such as `share.lpm.cx` needs the zone on Cloudflare; moving
to one means changing `DEFAULT_RELAY` in `sharerelay.rs` and `RELAYS` in the
website's join page. Deploying a new version disconnects every WebSocket; lpm
and the page both reconnect on their own.
