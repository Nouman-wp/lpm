use super::State;

fn state(switch_on: bool, phones: bool, computers: bool) -> State {
    State {
        switch_on,
        phones,
        computers,
        ..State::default()
    }
}

#[test]
fn holds_for_phones_or_computers_while_the_switch_is_on() {
    assert!(state(true, true, false).wants());
    assert!(state(true, false, true).wants());
    assert!(state(true, true, true).wants());
    assert!(!state(true, false, false).wants());
    assert!(!state(false, true, true).wants());
}

#[test]
fn allow_control_alone_reports_awake_or_battery_rather_than_paused() {
    assert_eq!(state(true, false, true).report(|| true), "awake");
    assert_eq!(state(true, false, true).report(|| false), "battery");
    assert_eq!(state(true, true, false).report(|| true), "awake");
    assert_eq!(state(true, false, false).report(|| true), "paused");
    assert_eq!(state(false, true, true).report(|| true), "off");
}

#[test]
fn a_failed_hold_reports_failed_on_power() {
    let st = State {
        failed: true,
        ..state(true, false, true)
    };
    assert_eq!(st.report(|| true), "failed");
}

// set_for_computers tells open panes only when the second value is true.
#[test]
fn allow_control_starts_and_stops_the_hold_and_says_so() {
    let mut st = state(true, false, false);
    assert_eq!(st.apply(|s| s.computers = true), (true, true));
    assert!(st.want);
    assert_eq!(st.apply(|s| s.computers = true), (false, false));
    assert_eq!(st.apply(|s| s.computers = false), (true, true));
    assert!(!st.want);
    assert_eq!(st.report(|| true), "paused");
}

#[test]
fn allow_control_changes_nothing_while_phones_already_hold_it() {
    let mut st = state(true, true, false);
    st.apply(|_| {});
    assert_eq!(st.apply(|s| s.computers = true), (false, false));
    assert_eq!(st.apply(|s| s.computers = false), (false, false));
    assert!(st.want);
}

#[test]
fn allow_control_changes_nothing_while_the_switch_is_off() {
    let mut st = state(false, false, false);
    assert_eq!(st.apply(|s| s.computers = true), (false, false));
    assert!(!st.want);
    assert_eq!(st.report(|| true), "off");
}

#[test]
fn allow_control_off_and_on_again_retries_a_failed_hold() {
    let mut st = state(true, false, true);
    st.apply(|_| {});
    st.failed = true;
    st.cooldown = 3;
    let generation = st.generation;
    assert_eq!(st.apply(|s| s.computers = false), (true, true));
    assert!(!st.failed);
    assert_eq!(st.cooldown, 0);
    assert_eq!(st.apply(|s| s.computers = true), (true, true));
    assert_eq!(st.generation, generation + 2);
    assert_eq!(st.report(|| true), "awake");
}
