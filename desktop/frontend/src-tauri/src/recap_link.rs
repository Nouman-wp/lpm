//! A link to a weekly recap card, for a post: the card goes up to the share
//! relay, and lpm.cx/w/<id> shows it as the post's preview image. Only the
//! image leaves the computer, and only when someone posts or copies a link.
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const UPLOAD_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecapLink {
    url: String,
    image: String,
}

#[tauri::command(async)]
pub fn upload_recap_image(b64_data: String) -> Result<RecapLink, String> {
    let png = B64
        .decode(b64_data.as_bytes())
        .map_err(|e| format!("decode image: {e}"))?;
    // The blocking client brings a runtime of its own, which can't be dropped
    // on the async runtime's threads that commands run on.
    std::thread::spawn(move || upload(png))
        .join()
        .map_err(|_| "the upload stopped unexpectedly".to_string())?
}

fn upload(png: Vec<u8>) -> Result<RecapLink, String> {
    let base =
        crate::sharerelay::relay_base().ok_or("Sharing links is turned off on this computer")?;
    let endpoint = base.join("recap").map_err(|e| e.to_string())?;
    let response = reqwest::blocking::Client::builder()
        .timeout(UPLOAD_TIMEOUT)
        .user_agent("lpm")
        .build()
        .map_err(|e| e.to_string())?
        .post(endpoint)
        .header("Content-Type", "image/png")
        .body(png)
        .send()
        .map_err(|e| format!("Couldn't reach lpm.cx: {e}"))?;
    let status = response.status();
    if status.as_u16() == 429 {
        return Err("Too many links in a minute; try again shortly".into());
    }
    if !status.is_success() {
        let reason = response.text().unwrap_or_default();
        return Err(format!(
            "lpm.cx refused the image ({status}): {}",
            reason.trim()
        ));
    }
    let body = response.text().map_err(|e| e.to_string())?;
    serde_json::from_str(&body).map_err(|e| format!("unreadable answer: {e}"))
}
