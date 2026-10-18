// Port tunnel: a paired Mac opens a web server running on this host as if it ran
// on its own localhost. The Mac listens on a loopback port of its own; each
// connection to it becomes a stream over the peer connection, which the host
// dials on its own loopback. Bytes ride as base64 in `tcpData` frames, queued
// with backpressure: unlike terminal output, a byte stream can't be reseeded.
//
// Frames, all keyed by a stream `id` the client picks:
//   client → host  tcpOpen { id, port } · tcpData { id, d } · tcpClose { id }
//   host → client  tcpData { id, d } · tcpClose { id, error? }
// `tcpClose` means "no more bytes from me": each side half-closes its socket on
// it, so a request/response that ends with a half-close still works.
use crate::peerclient::PeerClientHub;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, SyncSender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// Advertised in `ready` by a host that answers the tunnel frames.
pub(crate) const PORT_TUNNEL_FEATURE: &str = "portTunnel";

const CHUNK: usize = 32 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const UNSUPPORTED: &str =
    "that machine's lpm is too old to open its web servers here — update it there first";

/// One stream's write side, until the far end says it is done sending.
struct Stream {
    inbox: Option<Sender<Vec<u8>>>,
    read_done: bool,
}

type Streams<K> = Mutex<HashMap<K, Stream>>;

fn register<K: std::hash::Hash + Eq>(streams: &Streams<K>, key: K) -> Receiver<Vec<u8>> {
    let (tx, rx) = mpsc::channel();
    streams.lock().unwrap().insert(
        key,
        Stream {
            inbox: Some(tx),
            read_done: false,
        },
    );
    rx
}

fn deliver<K: std::hash::Hash + Eq>(streams: &Streams<K>, key: &K, v: &Value) {
    let Some(bytes) = v
        .get("d")
        .and_then(Value::as_str)
        .and_then(|d| B64.decode(d).ok())
    else {
        return;
    };
    if let Some(inbox) = streams
        .lock()
        .unwrap()
        .get(key)
        .and_then(|s| s.inbox.as_ref())
    {
        let _ = inbox.send(bytes);
    }
}

/// The far end sent its last byte: let what is queued drain, then half-close.
fn end_writing<K: std::hash::Hash + Eq>(streams: &Streams<K>, key: &K) {
    let mut map = streams.lock().unwrap();
    if let Some(stream) = map.get_mut(key) {
        stream.inbox = None;
        if stream.read_done {
            map.remove(key);
        }
    }
}

fn end_reading<K: std::hash::Hash + Eq>(streams: &Streams<K>, key: &K) {
    let mut map = streams.lock().unwrap();
    if let Some(stream) = map.get_mut(key) {
        stream.read_done = true;
        if stream.inbox.is_none() {
            map.remove(key);
        }
    }
}

fn data_frame(id: u64, bytes: &[u8]) -> Value {
    json!({ "t": "tcpData", "id": id, "d": B64.encode(bytes) })
}

/// Carry `socket` over the link: what it reads goes out through `send` (which
/// waits for room and says whether the link is still up), ending with a
/// `tcpClose`; what arrives on `inbox` is written to it.
fn run_pipe(
    socket: TcpStream,
    inbox: Receiver<Vec<u8>>,
    id: u64,
    send: impl Fn(Value) -> bool + Send + 'static,
    on_read_end: impl FnOnce() + Send + 'static,
) {
    let Ok(mut reader) = socket.try_clone() else {
        let _ = send(json!({ "t": "tcpClose", "id": id }));
        on_read_end();
        return;
    };
    let mut writer = socket;
    std::thread::spawn(move || {
        for bytes in inbox {
            if writer.write_all(&bytes).is_err() {
                break;
            }
        }
        let _ = writer.shutdown(Shutdown::Write);
    });
    std::thread::spawn(move || {
        let mut buf = vec![0u8; CHUNK];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if !send(data_frame(id, &buf[..n])) {
                        break;
                    }
                }
            }
        }
        let _ = reader.shutdown(Shutdown::Read);
        let _ = send(json!({ "t": "tcpClose", "id": id }));
        on_read_end();
    });
}

// --- host --------------------------------------------------------------------

type HostKey = (u64, u64); // (peer connection, stream)

fn host_streams() -> &'static Streams<HostKey> {
    static STREAMS: OnceLock<Streams<HostKey>> = OnceLock::new();
    STREAMS.get_or_init(Default::default)
}

/// Answer one tunnel frame from the client on connection `conn_id`.
pub(crate) fn handle_host(conn_id: u64, out: &SyncSender<String>, t: &str, v: &Value) {
    let Some(id) = v.get("id").and_then(Value::as_u64) else {
        return;
    };
    let key = (conn_id, id);
    match t {
        "tcpOpen" => {
            let port = v.get("port").and_then(Value::as_u64).unwrap_or(0);
            match u16::try_from(port) {
                Ok(port) if port > 0 => open_on_host(key, out.clone(), port),
                _ => {
                    let _ = out.send(close_frame(id, "bad port"));
                }
            }
        }
        "tcpData" => deliver(host_streams(), &key, v),
        "tcpClose" => end_writing(host_streams(), &key),
        _ => {}
    }
}

fn close_frame(id: u64, error: &str) -> String {
    json!({ "t": "tcpClose", "id": id, "error": error }).to_string()
}

/// Dial `port` on this host's own loopback for the stream. Bytes that arrive
/// before the dial completes wait in the stream's inbox.
fn open_on_host(key: HostKey, out: SyncSender<String>, port: u16) {
    let inbox = register(host_streams(), key);
    std::thread::spawn(move || {
        let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        let socket = match TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT) {
            Ok(socket) => socket,
            Err(e) => {
                host_streams().lock().unwrap().remove(&key);
                let _ = out.send(close_frame(key.1, &e.to_string()));
                return;
            }
        };
        let _ = socket.set_nodelay(true);
        let send = move |frame: Value| out.send(frame.to_string()).is_ok();
        run_pipe(socket, inbox, key.1, send, move || {
            end_reading(host_streams(), &key)
        });
    });
}

/// A client went away: end every stream it had open here.
pub(crate) fn drop_host_conn(conn_id: u64) {
    host_streams()
        .lock()
        .unwrap()
        .retain(|(conn, _), _| *conn != conn_id);
}

// --- client ------------------------------------------------------------------

type ClientKey = (String, u64); // (peer slug, stream)

fn client_streams() -> &'static Streams<ClientKey> {
    static STREAMS: OnceLock<Streams<ClientKey>> = OnceLock::new();
    STREAMS.get_or_init(Default::default)
}

/// Each host port this Mac forwards, by (peer slug, host port): its local port.
fn forwards() -> &'static Mutex<HashMap<(String, u16), u16>> {
    static FORWARDS: OnceLock<Mutex<HashMap<(String, u16), u16>>> = OnceLock::new();
    FORWARDS.get_or_init(Default::default)
}

fn next_stream_id() -> u64 {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    NEXT.fetch_add(1, Ordering::Relaxed)
}

/// The local port that reaches `port` on the host `slug`, opening it the first
/// time: the same number when it is free here, any free one otherwise.
pub(crate) fn forward(hub: &PeerClientHub, slug: &str, port: u16) -> Result<u16, String> {
    if !hub.supports_port_tunnel(slug) {
        return Err(UNSUPPORTED.to_string());
    }
    let mut map = forwards().lock().unwrap();
    if let Some(local) = map.get(&(slug.to_string(), port)) {
        return Ok(*local);
    }
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, port))
        .or_else(|_| TcpListener::bind((Ipv4Addr::LOCALHOST, 0)))
        .map_err(|e| format!("couldn't open a local port: {e}"))?;
    let local = listener.local_addr().map_err(|e| e.to_string())?.port();
    map.insert((slug.to_string(), port), local);
    let (hub, slug) = (hub.clone(), slug.to_string());
    std::thread::spawn(move || accept_loop(listener, hub, slug, port));
    Ok(local)
}

fn accept_loop(listener: TcpListener, hub: PeerClientHub, slug: String, port: u16) {
    for socket in listener.incoming().flatten() {
        let _ = socket.set_nodelay(true);
        let id = next_stream_id();
        let key = (slug.clone(), id);
        let inbox = register(client_streams(), key.clone());
        let open = json!({ "t": "tcpOpen", "id": id, "port": port }).to_string();
        if hub.send_waiting(&slug, open).is_err() {
            client_streams().lock().unwrap().remove(&key);
            continue;
        }
        let send = {
            let (hub, slug) = (hub.clone(), slug.clone());
            move |frame: Value| hub.send_waiting(&slug, frame.to_string()).is_ok()
        };
        run_pipe(socket, inbox, id, send, move || {
            end_reading(client_streams(), &key)
        });
    }
}

/// Apply one tunnel frame from the host `slug`.
pub(crate) fn handle_client(slug: &str, t: &str, v: &Value) {
    let Some(id) = v.get("id").and_then(Value::as_u64) else {
        return;
    };
    let key = (slug.to_string(), id);
    match t {
        "tcpData" => deliver(client_streams(), &key, v),
        "tcpClose" => end_writing(client_streams(), &key),
        _ => {}
    }
}

/// The connection to `slug` ended: its streams end with it. Its forwards stay
/// open and carry new connections once it is back.
pub(crate) fn drop_client_conn(slug: &str) {
    client_streams()
        .lock()
        .unwrap()
        .retain(|(peer, _), _| peer != slug);
}

/// The local port that reaches `port` on the paired machine `slug`.
#[tauri::command(async)]
pub fn peer_port_forward(
    hub: tauri::State<'_, PeerClientHub>,
    slug: String,
    port: u16,
) -> Result<u16, String> {
    forward(hub.inner(), &slug, port)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stream_is_forgotten_once_both_directions_end() {
        let streams: Streams<u64> = Default::default();
        let _inbox = register(&streams, 1);
        end_reading(&streams, &1);
        assert!(streams.lock().unwrap().contains_key(&1));
        end_writing(&streams, &1);
        assert!(!streams.lock().unwrap().contains_key(&1));
    }

    #[test]
    fn delivered_bytes_reach_the_inbox_in_order() {
        let streams: Streams<u64> = Default::default();
        let inbox = register(&streams, 7);
        deliver(&streams, &7, &data_frame(7, b"GET / "));
        deliver(&streams, &7, &data_frame(7, b"HTTP/1.1"));
        end_writing(&streams, &7);
        let got: Vec<u8> = inbox.iter().flatten().collect();
        assert_eq!(got, b"GET / HTTP/1.1");
    }

    #[test]
    fn a_pipe_relays_both_ways_and_half_closes() {
        let server = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let addr = server.local_addr().unwrap();
        let echo = std::thread::spawn(move || {
            let (mut socket, _) = server.accept().unwrap();
            let mut request = Vec::new();
            socket.read_to_end(&mut request).unwrap();
            socket.write_all(&request.to_ascii_uppercase()).unwrap();
        });
        let streams: &'static Streams<u64> = Box::leak(Box::default());
        let inbox = register(streams, 3);
        let (sent_tx, sent_rx) = mpsc::channel::<Value>();
        run_pipe(
            TcpStream::connect(addr).unwrap(),
            inbox,
            3,
            move |frame| sent_tx.send(frame).is_ok(),
            || {},
        );
        deliver(streams, &3, &data_frame(3, b"hello"));
        end_writing(streams, &3);
        echo.join().unwrap();
        let mut reply = Vec::new();
        for frame in sent_rx.iter() {
            match frame["t"].as_str() {
                Some("tcpData") => reply.extend(B64.decode(frame["d"].as_str().unwrap()).unwrap()),
                Some("tcpClose") => break,
                _ => {}
            }
        }
        assert_eq!(reply, b"HELLO");
    }
}
