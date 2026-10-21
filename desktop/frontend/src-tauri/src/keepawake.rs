// Keeps this machine from idle-sleeping while Keep awake is on and something may
// reach it from elsewhere: phones while remote control is on, other computers
// while Allow control is on, so either still finds it away from home. It holds
// only while the machine runs on power: on battery it sleeps as usual, and
// closing a laptop's lid still sleeps it.
use std::sync::{LazyLock, Mutex, OnceLock};
use std::time::Duration;

const POLL: Duration = Duration::from_secs(30);
// After a hold fails, wait this many checks before trying again, so a helper
// the system refuses isn't started every 30 seconds.
const RETRY_POLLS: u32 = 10;

#[derive(Default)]
struct State {
    switch_on: bool,
    phones: bool,
    computers: bool,
    want: bool,
    generation: u64,
    hold: Option<Hold>,
    failed: bool,
    cooldown: u32,
}

impl State {
    fn reachable(&self) -> bool {
        self.phones || self.computers
    }

    fn wants(&self) -> bool {
        self.switch_on && self.reachable()
    }

    fn report(&self, on_power: impl FnOnce() -> bool) -> &'static str {
        if !self.switch_on {
            "off"
        } else if !self.reachable() {
            "paused"
        } else if self.failed {
            "failed"
        } else if on_power() {
            "awake"
        } else {
            "battery"
        }
    }

    /// Applies `change`, dropping the hold when what it wants changes. Returns
    /// whether that changed, and whether what `status` reports changed; the
    /// power source is the same throughout.
    fn apply(&mut self, change: impl FnOnce(&mut Self)) -> (bool, bool) {
        let before = self.report(|| true);
        change(self);
        let want = self.wants();
        let want_changed = self.want != want;
        if want_changed {
            self.want = want;
            self.generation += 1;
            self.hold = None;
            self.failed = false;
            self.cooldown = 0;
        }
        (want_changed, self.report(|| true) != before)
    }
}

static STATE: LazyLock<Mutex<State>> = LazyLock::new(Mutex::default);
static ON_CHANGE: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();

/// Called when what `status` reports changes without the phone settings
/// changing: the machine was plugged in or unplugged, the hold failed, or Allow
/// control was turned on or off.
pub(crate) fn on_change(f: impl Fn() + Send + Sync + 'static) {
    let _ = ON_CHANGE.set(Box::new(f));
}

fn notify() {
    if let Some(notify) = ON_CHANGE.get() {
        notify();
    }
}

/// The Keep awake switch and whether phones may reach this machine (remote
/// control on), both saved with the phone settings. Safe to call repeatedly.
pub(crate) fn set_for_phones(switch_on: bool, remote_on: bool) {
    update(|st| {
        st.switch_on = switch_on;
        st.phones = remote_on;
    });
}

/// Whether other computers may reach this machine (Allow control on). Safe to
/// call repeatedly.
pub(crate) fn set_for_computers(allow_control: bool) {
    if update(|st| st.computers = allow_control) {
        notify();
    }
}

/// Let this machine sleep again, whatever the settings say.
pub(crate) fn release() {
    update(|st| st.switch_on = false);
}

/// Applies `change`, then takes or drops the hold to match. Returns whether
/// that changed what `status` reports.
fn update(change: impl FnOnce(&mut State)) -> bool {
    let mut st = STATE.lock().unwrap();
    let (want_changed, status_changed) = st.apply(change);
    if want_changed && st.want && supported() {
        let generation = st.generation;
        std::thread::spawn(move || watch(generation));
    }
    status_changed
}

#[cfg(test)]
pub(crate) fn allows_computers() -> bool {
    STATE.lock().unwrap().computers
}

/// Re-checks the power source now and then: the hold is taken on power and
/// dropped on battery.
fn watch(generation: u64) {
    // Settings last read the hold as not failed, before the first try to take it.
    let mut reported = (on_power(), false);
    loop {
        let acquire_now = {
            let mut st = STATE.lock().unwrap();
            if st.generation != generation {
                return;
            }
            if !on_power() {
                st.hold = None;
                false
            } else if st.hold.as_mut().is_some_and(Hold::refresh) {
                false
            } else {
                if st.hold.take().is_some() {
                    st.failed = true;
                    st.cooldown = RETRY_POLLS;
                }
                if st.cooldown > 0 {
                    st.cooldown -= 1;
                    false
                } else {
                    true
                }
            }
        };
        if acquire_now {
            let hold = acquire();
            let mut st = STATE.lock().unwrap();
            if st.generation != generation {
                return;
            }
            st.failed = hold.is_none();
            if st.failed {
                st.cooldown = RETRY_POLLS;
            }
            st.hold = hold;
        }
        let now = (on_power(), STATE.lock().unwrap().failed);
        if now != reported {
            notify();
        }
        reported = now;
        std::thread::sleep(POLL);
    }
}

/// What Settings says about it: "unsupported", "off" (switch off), "paused"
/// (neither remote control nor Allow control on), "failed", "awake" or
/// "battery".
pub(crate) fn status() -> &'static str {
    if !supported() {
        return "unsupported";
    }
    STATE.lock().unwrap().report(on_power)
}

fn supported() -> bool {
    #[cfg(any(target_os = "macos", windows))]
    {
        true
    }
    #[cfg(target_os = "linux")]
    {
        static INHIBIT: LazyLock<bool> =
            LazyLock::new(|| !crate::sys::headless() && crate::sys::which("systemd-inhibit"));
        *INHIBIT
    }
    #[cfg(all(unix, not(any(target_os = "macos", target_os = "linux"))))]
    {
        false
    }
}

// --- macOS: `caffeinate -s` holds a power assertion that the system honours
// only on power, and `-w` ends it with this process.

#[cfg(target_os = "macos")]
struct Hold(std::process::Child);

#[cfg(target_os = "macos")]
fn acquire() -> Option<Hold> {
    crate::osproc::command("/usr/bin/caffeinate")
        .arg("-s")
        .arg("-w")
        .arg(std::process::id().to_string())
        .spawn()
        .ok()
        .map(Hold)
}

#[cfg(target_os = "macos")]
fn on_power() -> bool {
    use core_foundation::base::{CFRelease, CFTypeRef, TCFType};
    use core_foundation::string::{CFString, CFStringRef};

    #[link(name = "IOKit", kind = "framework")]
    extern "C" {
        fn IOPSCopyPowerSourcesInfo() -> CFTypeRef;
        fn IOPSGetProvidingPowerSourceType(snapshot: CFTypeRef) -> CFStringRef;
    }
    unsafe {
        let snapshot = IOPSCopyPowerSourcesInfo();
        if snapshot.is_null() {
            return true;
        }
        let source = IOPSGetProvidingPowerSourceType(snapshot);
        let battery = !source.is_null()
            && CFString::wrap_under_get_rule(source).to_string() == "Battery Power";
        CFRelease(snapshot);
        !battery
    }
}

// --- Linux desktop: a logind inhibitor, held by `systemd-inhibit` around a
// command that ends with this process.

#[cfg(target_os = "linux")]
struct Hold(std::process::Child);

#[cfg(target_os = "linux")]
fn acquire() -> Option<Hold> {
    crate::osproc::command("systemd-inhibit")
        .args([
            "--no-ask-password",
            "--what=idle:sleep",
            "--who=lpm",
            "--why=Remote control or Allow control is on",
            "--mode=block",
            "tail",
        ])
        .arg(format!("--pid={}", std::process::id()))
        .args(["-f", "/dev/null"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()
        .map(Hold)
        .and_then(|mut hold| {
            // logind or polkit can refuse the inhibitor; the helper then exits
            // straight away instead of failing to start.
            std::thread::sleep(Duration::from_millis(300));
            hold.refresh().then_some(hold)
        })
}

#[cfg(target_os = "linux")]
fn on_power() -> bool {
    let Ok(supplies) = std::fs::read_dir("/sys/class/power_supply") else {
        return true;
    };
    let mut mains = false;
    for supply in supplies.flatten() {
        let read =
            |name: &str| std::fs::read_to_string(supply.path().join(name)).unwrap_or_default();
        if read("type").trim() == "Mains" {
            mains = true;
            if read("online").trim() == "1" {
                return true;
            }
        }
    }
    !mains
}

#[cfg(unix)]
impl Hold {
    /// Whether the hold is still in force: the helper may have been refused.
    fn refresh(&mut self) -> bool {
        matches!(self.0.try_wait(), Ok(None))
    }
}

#[cfg(unix)]
impl Drop for Hold {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[cfg(all(unix, not(any(target_os = "macos", target_os = "linux"))))]
fn acquire() -> Option<Hold> {
    None
}

#[cfg(all(unix, not(any(target_os = "macos", target_os = "linux"))))]
fn on_power() -> bool {
    true
}

// --- Windows: resetting the system idle timer on every check keeps it from
// sleeping, without holding anything that could outlive the app.

#[cfg(windows)]
struct Hold;

#[cfg(windows)]
fn acquire() -> Option<Hold> {
    let mut hold = Hold;
    hold.refresh().then_some(hold)
}

#[cfg(windows)]
impl Hold {
    fn refresh(&mut self) -> bool {
        use windows_sys::Win32::System::Power::{SetThreadExecutionState, ES_SYSTEM_REQUIRED};
        unsafe { SetThreadExecutionState(ES_SYSTEM_REQUIRED) != 0 }
    }
}

#[cfg(windows)]
fn on_power() -> bool {
    use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut s: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
    if unsafe { GetSystemPowerStatus(&mut s) } == 0 {
        return true;
    }
    s.ACLineStatus != 0
}

#[cfg(test)]
#[path = "keepawake_tests.rs"]
mod tests;
