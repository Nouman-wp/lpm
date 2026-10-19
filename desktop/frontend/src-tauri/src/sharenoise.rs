// End-to-end encryption between this machine and one browser guest of a shared
// tab, carried by the relay (sharerelay.rs). Noise NK: the guest knows the share's
// public key from the invite, which the relay never sees, so the relay can neither
// read the session nor stand in for this machine.
//
// A frame (one JSON text) travels as one or more Noise messages, each opening with
// a flag byte: 1 on the frame's last piece, 0 on the ones before it. Must stay
// byte-identical to relay/public/noise.js.
use snow::{params::NoiseParams, Builder, Keypair, TransportState};

const PATTERN: &str = "Noise_NK_25519_AESGCM_SHA256";
const PROLOGUE: &str = "lpm-share-relay/1 ";
const TAG: usize = 16;
const MAX_MESSAGE: usize = 65535;
const PIECE: usize = 32 * 1024;
// Far above any frame lpm sends (a seed is a terminal's ring), so a guest can't
// make this machine buffer without bound.
const MAX_FRAME: usize = 16 * 1024 * 1024;

fn params() -> NoiseParams {
    PATTERN.parse().expect("valid noise pattern")
}

fn prologue(room: &str) -> Vec<u8> {
    format!("{PROLOGUE}{room}").into_bytes()
}

pub(crate) fn keypair() -> Keypair {
    Builder::new(params())
        .generate_keypair()
        .expect("x25519 keypair")
}

// Distinct at a glance, easy to name aloud, and each one code point every platform
// draws as emoji. Sixty-four, so each carries six bits of the handshake hash.
const MATCH_EMOJI: [&str; 64] = [
    "🐶", "🐱", "🦁", "🐎", "🦄", "🐷", "🐘", "🐰", "🐼", "🐓", "🐧", "🐢", "🐟", "🐙", "🦋", "🌷",
    "🌳", "🌵", "🍄", "🌏", "🌙", "🌈", "🔥", "🍌", "🍎", "🍓", "🌽", "🍕", "🎂", "💎", "😀", "🤖",
    "🎩", "👓", "🔧", "🎅", "👍", "🎈", "⌛", "⏰", "🎁", "💡", "📕", "🍩", "📎", "🧲", "🔒", "🔑",
    "🔨", "📷", "🏁", "🚂", "🚲", "🚁", "🚀", "🏆", "⚽", "🎸", "🎺", "🔔", "⚓", "🎧", "📁", "📌",
];

/// Four emoji both ends derive from the handshake. The host can ask which ones the
/// guest sees before letting them in, so someone else holding a forwarded invite
/// can't pass for the person it was sent to.
fn match_code(hash: &[u8]) -> String {
    let bits = u32::from_be_bytes([0, hash[0], hash[1], hash[2]]);
    [18, 12, 6, 0]
        .map(|shift| MATCH_EMOJI[(bits >> shift) as usize & 63])
        .join(" ")
}

pub(crate) struct Accepted {
    pub session: Session,
    pub reply: Vec<u8>,
    pub code: String,
}

/// Answer a guest's opening handshake message for the room `room`.
pub(crate) fn accept(private: &[u8], room: &str, first: &[u8]) -> Option<Accepted> {
    if first.len() > MAX_MESSAGE {
        return None;
    }
    let prologue = prologue(room);
    let mut hs = Builder::new(params())
        .local_private_key(private)
        .ok()?
        .prologue(&prologue)
        .ok()?
        .build_responder()
        .ok()?;
    let mut scratch = vec![0u8; first.len()];
    hs.read_message(first, &mut scratch).ok()?;
    let mut reply = vec![0u8; 128];
    let n = hs.write_message(&[], &mut reply).ok()?;
    reply.truncate(n);
    let code = match_code(hs.get_handshake_hash());
    let transport = hs.into_transport_mode().ok()?;
    Some(Accepted {
        session: Session {
            transport,
            partial: Vec::new(),
        },
        reply,
        code,
    })
}

pub(crate) struct Session {
    transport: TransportState,
    partial: Vec<u8>,
}

impl Session {
    /// The Noise messages that carry `frame`.
    pub(crate) fn seal(&mut self, frame: &[u8]) -> Result<Vec<Vec<u8>>, ()> {
        let mut pieces: Vec<&[u8]> = frame.chunks(PIECE).collect();
        if pieces.is_empty() {
            pieces.push(&[]);
        }
        let last = pieces.len() - 1;
        let mut out = Vec::with_capacity(pieces.len());
        for (i, piece) in pieces.into_iter().enumerate() {
            let mut plain = Vec::with_capacity(piece.len() + 1);
            plain.push(u8::from(i == last));
            plain.extend_from_slice(piece);
            let mut message = vec![0u8; plain.len() + TAG];
            let n = self
                .transport
                .write_message(&plain, &mut message)
                .map_err(|_| ())?;
            message.truncate(n);
            out.push(message);
        }
        Ok(out)
    }

    /// Open one Noise message: the whole frame once its last piece is in.
    pub(crate) fn open(&mut self, message: &[u8]) -> Result<Option<Vec<u8>>, ()> {
        if message.len() > MAX_MESSAGE || message.len() <= TAG {
            return Err(());
        }
        let mut plain = vec![0u8; message.len()];
        let n = self
            .transport
            .read_message(message, &mut plain)
            .map_err(|_| ())?;
        let (&flag, body) = plain[..n].split_first().ok_or(())?;
        if self.partial.len() + body.len() > MAX_FRAME {
            return Err(());
        }
        self.partial.extend_from_slice(body);
        match flag {
            1 => Ok(Some(std::mem::take(&mut self.partial))),
            0 => Ok(None),
            _ => Err(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ROOM: &str = "AAAAAAAAAAAAAAAAAAAAAA";

    struct Guest {
        transport: TransportState,
        code: String,
    }

    fn guest_handshake(
        public: &[u8],
        room: &str,
        host_private: &[u8],
    ) -> Option<(Guest, Accepted)> {
        let prologue = prologue(room);
        let mut hs = Builder::new(params())
            .remote_public_key(public)
            .unwrap()
            .prologue(&prologue)
            .unwrap()
            .build_initiator()
            .unwrap();
        let mut first = vec![0u8; 128];
        let n = hs.write_message(&[], &mut first).unwrap();
        let accepted = accept(host_private, ROOM, &first[..n])?;
        let mut scratch = vec![0u8; 128];
        hs.read_message(&accepted.reply, &mut scratch).ok()?;
        let code = match_code(hs.get_handshake_hash());
        Some((
            Guest {
                transport: hs.into_transport_mode().unwrap(),
                code,
            },
            accepted,
        ))
    }

    fn guest_seal(guest: &mut Guest, flag: u8, body: &[u8]) -> Vec<u8> {
        let mut plain = vec![flag];
        plain.extend_from_slice(body);
        let mut message = vec![0u8; plain.len() + TAG];
        let n = guest.transport.write_message(&plain, &mut message).unwrap();
        message.truncate(n);
        message
    }

    #[test]
    fn both_ends_agree_on_the_code_and_talk() {
        let host = keypair();
        let (mut guest, mut accepted) = guest_handshake(&host.public, ROOM, &host.private).unwrap();
        assert_eq!(guest.code, accepted.code);
        assert_eq!(accepted.code.split(' ').count(), 4);

        let hello = guest_seal(&mut guest, 1, br#"{"t":"ping"}"#);
        assert_eq!(
            accepted.session.open(&hello).unwrap().as_deref(),
            Some(&br#"{"t":"ping"}"#[..])
        );

        let sealed = accepted.session.seal(br#"{"t":"pong"}"#).unwrap();
        assert_eq!(sealed.len(), 1);
        let mut plain = vec![0u8; sealed[0].len()];
        let n = guest
            .transport
            .read_message(&sealed[0], &mut plain)
            .unwrap();
        assert_eq!(&plain[..n], b"\x01{\"t\":\"pong\"}");
    }

    #[test]
    fn a_big_frame_goes_in_pieces_and_comes_back_whole() {
        let host = keypair();
        let (mut guest, mut accepted) = guest_handshake(&host.public, ROOM, &host.private).unwrap();
        let frame = vec![b'x'; PIECE * 2 + 7];
        let sealed = accepted.session.seal(&frame).unwrap();
        assert_eq!(sealed.len(), 3);
        let mut whole = Vec::new();
        for (i, m) in sealed.iter().enumerate() {
            assert!(m.len() <= MAX_MESSAGE);
            let mut plain = vec![0u8; m.len()];
            let n = guest.transport.read_message(m, &mut plain).unwrap();
            assert_eq!(plain[0], u8::from(i == 2));
            whole.extend_from_slice(&plain[1..n]);
        }
        assert_eq!(whole, frame);

        assert_eq!(
            accepted.session.open(&guest_seal(&mut guest, 0, b"ab")),
            Ok(None)
        );
        assert_eq!(
            accepted.session.open(&guest_seal(&mut guest, 1, b"cd")),
            Ok(Some(b"abcd".to_vec()))
        );
    }

    #[test]
    fn the_wrong_key_or_room_never_completes() {
        let host = keypair();
        let other = keypair();
        assert!(guest_handshake(&other.public, ROOM, &host.private).is_none());
        assert!(guest_handshake(&host.public, "BBBBBBBBBBBBBBBBBBBBBB", &host.private).is_none());
    }

    #[test]
    fn a_tampered_message_is_refused() {
        let host = keypair();
        let (mut guest, mut accepted) = guest_handshake(&host.public, ROOM, &host.private).unwrap();
        let mut hello = guest_seal(&mut guest, 1, b"{}");
        hello[3] ^= 1;
        assert_eq!(accepted.session.open(&hello), Err(()));
    }

    // relay/test/noise-vector.json pins the bytes both sides produce from fixed
    // keys, so this and relay/public/noise.js can't drift apart.
    #[test]
    fn matches_the_browsers_test_vector() {
        let vector: serde_json::Value =
            serde_json::from_str(include_str!("../../../../relay/test/noise-vector.json")).unwrap();
        let hex_of = |k: &str| hex::decode(vector[k].as_str().unwrap()).unwrap();
        let text_of = |k: &str| vector[k].as_str().unwrap().as_bytes().to_vec();
        let room = vector["room"].as_str().unwrap();
        let (host_private, guest_e, host_e) = (
            hex_of("hostPrivate"),
            hex_of("guestEphemeral"),
            hex_of("hostEphemeral"),
        );
        let mut dh = snow::resolvers::CryptoResolver::resolve_dh(
            &snow::resolvers::DefaultResolver,
            &snow::params::DHChoice::Curve25519,
        )
        .unwrap();
        dh.set(&host_private);
        let host_public = dh.pubkey().to_vec();
        let prologue = prologue(room);

        let mut guest = Builder::new(params())
            .remote_public_key(&host_public)
            .unwrap()
            .prologue(&prologue)
            .unwrap()
            .fixed_ephemeral_key_for_testing_only(&guest_e)
            .build_initiator()
            .unwrap();
        let mut host = Builder::new(params())
            .local_private_key(&host_private)
            .unwrap()
            .prologue(&prologue)
            .unwrap()
            .fixed_ephemeral_key_for_testing_only(&host_e)
            .build_responder()
            .unwrap();
        let mut buf = vec![0u8; 256];
        let mut scratch = vec![0u8; 256];
        let n = guest.write_message(&[], &mut buf).unwrap();
        let first = buf[..n].to_vec();
        host.read_message(&first, &mut scratch).unwrap();
        let n = host.write_message(&[], &mut buf).unwrap();
        let reply = buf[..n].to_vec();
        guest.read_message(&reply, &mut scratch).unwrap();
        let code = match_code(guest.get_handshake_hash());

        let mut host = Session {
            transport: host.into_transport_mode().unwrap(),
            partial: Vec::new(),
        };
        let mut guest = guest.into_transport_mode().unwrap();
        let mut plain = text_of("guestFrame");
        plain.insert(0, 1);
        let n = guest.write_message(&plain, &mut buf).unwrap();
        let guest_sealed = buf[..n].to_vec();
        let host_sealed = host.seal(&text_of("hostFrame")).unwrap().remove(0);

        let got = serde_json::json!({
            "first": hex::encode(&first),
            "reply": hex::encode(&reply),
            "emoji": code,
            "guestSealed": hex::encode(&guest_sealed),
            "hostSealed": hex::encode(&host_sealed),
        });
        for k in ["first", "reply", "emoji", "guestSealed", "hostSealed"] {
            assert_eq!(got[k], vector[k], "{k}");
        }
        assert_eq!(
            host.open(&guest_sealed).unwrap(),
            Some(text_of("guestFrame"))
        );
    }
}
