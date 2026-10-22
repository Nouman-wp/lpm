// Local-socket types for every path-addressed socket lpm serves or dials (the
// status socket, the session daemon, the lesson socket, the CLI). Windows 10
// 1803+ speaks AF_UNIX too, so the protocols stay path-based on every platform;
// only the type behind the name changes.
#[cfg(unix)]
pub use std::os::unix::net::{UnixListener, UnixStream};
#[cfg(windows)]
pub use uds_windows::{UnixListener, UnixStream};

/// Longest socket path the platform's `sockaddr_un` holds (bytes, NUL excluded).
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub const MAX_SOCKET_PATH: usize = if cfg!(target_os = "macos") {
    103
} else {
    107
};

/// The pid of the process that connected `stream`, as the kernel recorded it
/// at connect time.
#[cfg(target_os = "macos")]
pub fn peer_pid(stream: &UnixStream) -> Option<u32> {
    use std::os::fd::AsRawFd;
    let mut pid: libc::pid_t = 0;
    let mut len = std::mem::size_of::<libc::pid_t>() as libc::socklen_t;
    let rc = unsafe {
        libc::getsockopt(
            stream.as_raw_fd(),
            libc::SOL_LOCAL,
            libc::LOCAL_PEERPID,
            &mut pid as *mut _ as *mut libc::c_void,
            &mut len,
        )
    };
    (rc == 0 && pid > 0).then_some(pid as u32)
}

#[cfg(target_os = "linux")]
pub fn peer_pid(stream: &UnixStream) -> Option<u32> {
    use std::os::fd::AsRawFd;
    let mut cred: libc::ucred = unsafe { std::mem::zeroed() };
    let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
    let rc = unsafe {
        libc::getsockopt(
            stream.as_raw_fd(),
            libc::SOL_SOCKET,
            libc::SO_PEERCRED,
            &mut cred as *mut _ as *mut libc::c_void,
            &mut len,
        )
    };
    (rc == 0 && cred.pid > 0).then_some(cred.pid as u32)
}

#[cfg(windows)]
pub fn peer_pid(stream: &UnixStream) -> Option<u32> {
    use std::os::windows::io::AsRawSocket;
    use windows_sys::Win32::Networking::WinSock::{WSAIoctl, SIO_AF_UNIX_GETPEERPID, SOCKET};
    let mut pid: u32 = 0;
    let mut returned: u32 = 0;
    let rc = unsafe {
        WSAIoctl(
            stream.as_raw_socket() as SOCKET,
            SIO_AF_UNIX_GETPEERPID,
            std::ptr::null(),
            0,
            &mut pid as *mut _ as *mut core::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
            &mut returned,
            std::ptr::null_mut(),
            None,
        )
    };
    (rc == 0 && pid != 0).then_some(pid)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};

    #[test]
    fn names_the_process_that_connected() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("p.sock");
        let listener = UnixListener::bind(&path).unwrap();
        let _client = UnixStream::connect(&path).unwrap();
        let (server, _) = listener.accept().unwrap();
        assert_eq!(peer_pid(&server), Some(std::process::id()));
    }

    #[test]
    fn round_trips_a_line_over_a_path_socket() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("t.sock");
        let listener = UnixListener::bind(&path).unwrap();
        let server = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut line = String::new();
            BufReader::new(&stream).read_line(&mut line).unwrap();
            (&stream).write_all(line.to_uppercase().as_bytes()).unwrap();
        });
        let mut client = UnixStream::connect(&path).unwrap();
        client.write_all(b"ping\n").unwrap();
        let mut reply = String::new();
        BufReader::new(&client).read_line(&mut reply).unwrap();
        server.join().unwrap();
        assert_eq!(reply, "PING\n");
    }
}
