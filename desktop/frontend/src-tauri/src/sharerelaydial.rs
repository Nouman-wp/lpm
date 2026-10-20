// The share relay's connection, dialed from this machine (sharerelay.rs).
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;
use tauri::Url;
use tungstenite::client::IntoClientRequest;
use tungstenite::protocol::WebSocketConfig;
use tungstenite::WebSocket;

const DIAL_TIMEOUT: Duration = Duration::from_secs(15);
// About twice the largest message the relay forwards. Refusing one ends the whole
// link, and every browser guest with it, so this must never be tight.
const MAX_RELAY_MESSAGE: usize = 128 * 1024;

pub(crate) enum RelayStream {
    Plain(TcpStream),
    Tls(Box<rustls::StreamOwned<rustls::ClientConnection, TcpStream>>),
}

impl RelayStream {
    pub(crate) fn tcp(&self) -> &TcpStream {
        match self {
            RelayStream::Plain(s) => s,
            RelayStream::Tls(t) => t.get_ref(),
        }
    }
}

impl Read for RelayStream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            RelayStream::Plain(s) => s.read(buf),
            RelayStream::Tls(t) => t.read(buf),
        }
    }
}

impl Write for RelayStream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        match self {
            RelayStream::Plain(s) => s.write(buf),
            RelayStream::Tls(t) => t.write(buf),
        }
    }
    fn flush(&mut self) -> io::Result<()> {
        match self {
            RelayStream::Plain(s) => s.flush(),
            RelayStream::Tls(t) => t.flush(),
        }
    }
}

pub(crate) type RelayWs = WebSocket<RelayStream>;

fn tls_config() -> Result<Arc<rustls::ClientConfig>, String> {
    use rustls_platform_verifier::BuilderVerifierExt;
    let provider = Arc::new(rustls::crypto::aws_lc_rs::default_provider());
    let config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .and_then(|b| b.with_platform_verifier())
        .map_err(|e| e.to_string())?
        .with_no_client_auth();
    Ok(Arc::new(config))
}

fn connect(relay: &Url) -> Result<TcpStream, String> {
    let addrs = relay.socket_addrs(|| None).map_err(|e| e.to_string())?;
    let mut last = "the relay has no address".to_string();
    for addr in addrs {
        match TcpStream::connect_timeout(&addr, DIAL_TIMEOUT) {
            Ok(tcp) => return Ok(tcp),
            Err(e) => last = e.to_string(),
        }
    }
    Err(last)
}

/// The host's end of `room`, claimed with `token`: wss with the OS's own
/// certificate checks, or plain ws to a relay on this machine.
pub(crate) fn dial(relay: &Url, room: &str, token: &str) -> Result<RelayWs, String> {
    let tcp = connect(relay)?;
    let _ = tcp.set_nodelay(true);
    let _ = tcp.set_read_timeout(Some(DIAL_TIMEOUT));
    let _ = tcp.set_write_timeout(Some(DIAL_TIMEOUT));
    let tls = relay.scheme() == "https";
    let mut url = relay.clone();
    let _ = url.set_scheme(if tls { "wss" } else { "ws" });
    url.set_path(&format!("/room/{room}/host"));
    url.set_query(None);
    let mut request = url
        .as_str()
        .into_client_request()
        .map_err(|e| e.to_string())?;
    let auth = format!("Bearer {token}").parse().map_err(|_| "bad token")?;
    request.headers_mut().insert("Authorization", auth);
    let stream = if tls {
        let host = relay.host_str().unwrap_or_default().to_string();
        let name = rustls::pki_types::ServerName::try_from(host).map_err(|e| e.to_string())?;
        let conn = rustls::ClientConnection::new(tls_config()?, name).map_err(|e| e.to_string())?;
        RelayStream::Tls(Box::new(rustls::StreamOwned::new(conn, tcp)))
    } else {
        RelayStream::Plain(tcp)
    };
    let config = WebSocketConfig::default()
        .max_message_size(Some(MAX_RELAY_MESSAGE))
        .max_frame_size(Some(MAX_RELAY_MESSAGE));
    let (ws, _) = tungstenite::client::client_with_config(request, stream, Some(config))
        .map_err(|e| e.to_string())?;
    Ok(ws)
}
