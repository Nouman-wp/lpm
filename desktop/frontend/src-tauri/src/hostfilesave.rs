//! Host half of a save from a paired Mac: a file here that an app there edits as
//! a copy (peercopysync.rs) comes back whole, in the pieces any upload takes
//! (peeruploadhost.rs), and replaces the file only while it still is what that
//! Mac last knew. Text or not, up to an upload's size.

use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tempfile::NamedTempFile;

/// Advertised in `ready`. A client saves this way only to a host it has seen
/// this from; an older one takes a single write of text, or no saves at all.
pub(crate) const FILE_SAVE_FEATURE: &str = "fileSave";

/// Copies `from` into `to` and answers with the SHA-256 of what passed, in hex.
fn copy_hashing(mut from: impl Read, mut to: impl Write) -> std::io::Result<String> {
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = from.read(&mut buf)?;
        if n == 0 {
            return Ok(hex::encode(hasher.finalize()));
        }
        hasher.update(&buf[..n]);
        to.write_all(&buf[..n])?;
    }
}

/// The SHA-256 of what `path` holds, in hex.
pub(crate) fn sha256_file(path: &Path) -> std::io::Result<String> {
    copy_hashing(File::open(path)?, std::io::sink())
}

/// Put the finished upload `upload` in place of `dest` while `dest` still hashes
/// to `expected`. Answers `{ written, sha256 }`, the hash of what `dest` holds
/// after. The swap is atomic, so the file is never seen half written; a link is
/// followed to the file it names.
pub(crate) fn save_over(upload: &Path, dest: &str, expected: &str) -> Result<Value, String> {
    crate::files::refuse_remote_write(dest)?;
    let path = std::fs::canonicalize(crate::config::expand_home(dest))
        .map_err(|e| format!("{dest}: {e}"))?;
    let meta = std::fs::metadata(&path).map_err(|e| format!("{dest}: {e}"))?;
    if !meta.is_file() {
        return Err(format!("not a file: {dest}"));
    }
    if meta.permissions().readonly() {
        return Err(format!("{dest} is read-only"));
    }
    let current = sha256_file(&path).map_err(|e| e.to_string())?;
    if current != expected {
        return Ok(json!({ "written": false, "sha256": current }));
    }
    let dir = path.parent().ok_or_else(|| format!("not a file: {dest}"))?;
    let tmp = NamedTempFile::new_in(dir).map_err(|e| e.to_string())?;
    let from = File::open(upload).map_err(|e| e.to_string())?;
    let sha256 = copy_hashing(from, tmp.as_file()).map_err(|e| e.to_string())?;
    tmp.as_file()
        .set_permissions(meta.permissions())
        .map_err(|e| e.to_string())?;
    crate::fsatomic::persist(tmp, &path).map_err(|e| e.to_string())?;
    Ok(json!({ "written": true, "sha256": sha256 }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn upload(dir: &Path, data: &[u8]) -> std::path::PathBuf {
        let path = dir.join("upload.bin");
        std::fs::write(&path, data).unwrap();
        path
    }

    #[test]
    fn a_save_replaces_the_file_it_started_from() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("logo.png");
        std::fs::write(&dest, [0x89, b'P', b'N', b'G']).unwrap();
        let started = sha256_file(&dest).unwrap();
        let sent = upload(dir.path(), &[0x89, b'P', b'N', b'G', 0x00, 0xff]);

        let saved = save_over(&sent, dest.to_str().unwrap(), &started).unwrap();
        assert_eq!(saved["written"], true);
        assert_eq!(
            std::fs::read(&dest).unwrap(),
            [0x89, b'P', b'N', b'G', 0x00, 0xff]
        );
        assert_eq!(saved["sha256"], sha256_file(&dest).unwrap());
    }

    #[test]
    fn a_file_changed_here_since_is_left_alone() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("data.bin");
        std::fs::write(&dest, b"before").unwrap();
        let started = sha256_file(&dest).unwrap();
        std::fs::write(&dest, b"edited here").unwrap();

        let saved = save_over(
            &upload(dir.path(), b"edited there"),
            dest.to_str().unwrap(),
            &started,
        )
        .unwrap();
        assert_eq!(saved["written"], false);
        assert_eq!(saved["sha256"], sha256_file(&dest).unwrap());
        assert_eq!(std::fs::read(&dest).unwrap(), b"edited here");
    }

    #[cfg(unix)]
    #[test]
    fn a_link_is_saved_through_and_the_mode_kept() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("run.sh");
        std::fs::write(&real, b"echo one\n").unwrap();
        std::fs::set_permissions(&real, std::fs::Permissions::from_mode(0o755)).unwrap();
        let link = dir.path().join("link.sh");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let started = sha256_file(&real).unwrap();

        let saved = save_over(
            &upload(dir.path(), b"echo two\n"),
            link.to_str().unwrap(),
            &started,
        )
        .unwrap();
        assert_eq!(saved["written"], true);
        assert!(std::fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(std::fs::read(&real).unwrap(), b"echo two\n");
        assert_eq!(
            std::fs::metadata(&real).unwrap().permissions().mode() & 0o777,
            0o755
        );
    }
}
