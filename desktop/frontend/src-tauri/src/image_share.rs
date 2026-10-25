//! A PNG the app made, such as the weekly recap card, put where it can be
//! shared: on the clipboard when the webview's own clipboard write is refused,
//! saved to Downloads, or handed to the macOS share sheet for a messenger.
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use std::path::{Path, PathBuf};

fn decode(b64_data: &str) -> Result<Vec<u8>, String> {
    let bytes = B64
        .decode(b64_data.as_bytes())
        .map_err(|e| format!("decode image: {e}"))?;
    if !bytes.starts_with(b"\x89PNG") {
        return Err("not a PNG image".into());
    }
    Ok(bytes)
}

/// `stem.png` in `dir`, or `stem 2.png` and onwards when that is taken.
fn free_path(dir: &Path, stem: &str) -> PathBuf {
    let mut path = dir.join(format!("{stem}.png"));
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("{stem} {n}.png"));
        n += 1;
    }
    path
}

fn clean_stem(name: &str) -> String {
    let stem: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | ' ' | '.') {
                c
            } else {
                '-'
            }
        })
        .collect();
    let stem = stem.trim_matches(['.', ' ']).to_string();
    if stem.is_empty() {
        "image".into()
    } else {
        stem
    }
}

/// Saves the image to Downloads (home when there is none); returns its path.
#[tauri::command(async)]
pub fn save_png_image(b64_data: String, name: String) -> Result<String, String> {
    let bytes = decode(&b64_data)?;
    let dir = dirs::download_dir()
        .or_else(dirs::home_dir)
        .ok_or("no folder to save to")?;
    let path = free_path(&dir, &clean_stem(&name));
    std::fs::write(&path, bytes).map_err(|e| format!("save image: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Where on the page the share sheet points from, in CSS pixels.
#[derive(serde::Deserialize, Clone, Copy)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct Anchor {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Opens the system share sheet with the image, under `anchor`: Messages,
/// Mail, AirDrop and any messenger that takes images.
#[tauri::command(async)]
pub fn share_png_image(
    app: tauri::AppHandle,
    b64_data: String,
    name: String,
    anchor: Anchor,
) -> Result<(), String> {
    let bytes = decode(&b64_data)?;
    let dir = std::env::temp_dir().join("lpm-share");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.png", clean_stem(&name)));
    std::fs::write(&path, bytes).map_err(|e| format!("save image: {e}"))?;
    show_share_sheet(&app, &path, anchor)
}

#[cfg(target_os = "macos")]
fn show_share_sheet(app: &tauri::AppHandle, path: &Path, anchor: Anchor) -> Result<(), String> {
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
    use tauri::Manager;
    // NSMaxYEdge: under the anchor, as the webview's coordinates run downwards.
    const BELOW: usize = 3;
    let window = app
        .get_webview_window("main")
        .ok_or("no window to share from")?;
    let path = path.to_string_lossy().into_owned();
    window
        .with_webview(move |webview| unsafe {
            let view: *mut AnyObject = webview.inner().cast();
            if view.is_null() {
                return;
            }
            let ns_path = NSString::from_str(&path);
            let url: *mut AnyObject = msg_send![class!(NSURL), fileURLWithPath: &*ns_path];
            let items: *mut AnyObject = msg_send![class!(NSArray), arrayWithObject: url];
            // Held for as long as the sheet is up; one small picker per share.
            let picker: *mut AnyObject = msg_send![class!(NSSharingServicePicker), alloc];
            let picker: *mut AnyObject = msg_send![picker, initWithItems: items];
            let rect = NSRect::new(
                NSPoint::new(anchor.x, anchor.y),
                NSSize::new(anchor.width.max(1.0), anchor.height.max(1.0)),
            );
            let _: () =
                msg_send![picker, showRelativeToRect: rect, ofView: view, preferredEdge: BELOW];
        })
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
fn show_share_sheet(_app: &tauri::AppHandle, _path: &Path, _anchor: Anchor) -> Result<(), String> {
    Err("Sharing to apps works on macOS; copy or save the image instead".into())
}

#[tauri::command(async)]
pub fn copy_png_image(b64_data: String) -> Result<(), String> {
    let bytes = decode(&b64_data)?;
    write_png(&bytes)
}

#[cfg(target_os = "macos")]
fn write_png(bytes: &[u8]) -> Result<(), String> {
    let file = tempfile::Builder::new()
        .prefix("lpm-image-")
        .suffix(".png")
        .tempfile()
        .map_err(|e| e.to_string())?;
    std::fs::write(file.path(), bytes).map_err(|e| e.to_string())?;
    let script = format!(
        "set the clipboard to (read (POSIX file \"{}\") as «class PNGf»)",
        file.path()
            .to_string_lossy()
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
    );
    let out = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("osascript: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn write_png(bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
    let (program, args): (&str, &[&str]) = if wayland && crate::sys::which("wl-copy") {
        ("wl-copy", &["--type", "image/png"])
    } else if crate::sys::which("xclip") {
        (
            "xclip",
            &["-selection", "clipboard", "-t", "image/png", "-i"],
        )
    } else {
        return Err("Copying an image needs wl-copy or xclip".into());
    };
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("spawn {program}: {e}"))?;
    let written = child
        .stdin
        .take()
        .ok_or_else(|| format!("{program} stdin unavailable"))
        .and_then(|mut stdin| stdin.write_all(bytes).map_err(|e| e.to_string()));
    let status = child.wait().map_err(|e| e.to_string())?;
    written?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{program} exited with {status}"))
    }
}

#[cfg(windows)]
fn write_png(_bytes: &[u8]) -> Result<(), String> {
    Err("Copy the image from the app instead".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_a_saved_image_without_overwriting_one() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(free_path(dir.path(), "week"), dir.path().join("week.png"));
        std::fs::write(dir.path().join("week.png"), b"x").unwrap();
        assert_eq!(free_path(dir.path(), "week"), dir.path().join("week 2.png"));
    }

    #[test]
    fn keeps_a_file_name_to_safe_characters() {
        assert_eq!(clean_stem("lpm week 2026-10-19"), "lpm week 2026-10-19");
        assert_eq!(clean_stem("../../etc/passwd"), "-..-etc-passwd");
        assert_eq!(clean_stem(" .. "), "image");
    }

    #[test]
    fn refuses_anything_but_a_png() {
        assert!(decode(&B64.encode(b"GIF89a")).is_err());
        assert!(decode(&B64.encode(b"\x89PNG\r\n")).is_ok());
    }
}
