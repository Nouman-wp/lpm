// A standard five-field cron line (minute hour day-of-month month day-of-week)
// as a job schedule, read in local time like every other lpm schedule. Lists,
// ranges, steps, month and weekday names and the @daily-style shorthands are
// understood; a day matches the way Vixie cron decides it — when both day
// fields are restricted, either one is enough.

use chrono::{Datelike, Duration, NaiveDate, TimeZone};

/// Far enough to reach the next 29 February from any date, 2100 included.
const SEARCH_DAYS: i64 = 366 * 8 + 2;

const MONTH_NAMES: [&str; 12] = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];
const DAY_NAMES: [&str; 7] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MACROS: [(&str, &str); 7] = [
    ("@yearly", "0 0 1 1 *"),
    ("@annually", "0 0 1 1 *"),
    ("@monthly", "0 0 1 * *"),
    ("@weekly", "0 0 * * 0"),
    ("@daily", "0 0 * * *"),
    ("@midnight", "0 0 * * *"),
    ("@hourly", "0 * * * *"),
];

struct Field {
    name: &'static str,
    min: u32,
    max: u32,
    names: &'static [&'static str],
    names_from: u32,
}

const MINUTE: Field = Field { name: "minute", min: 0, max: 59, names: &[], names_from: 0 };
const HOUR: Field = Field { name: "hour", min: 0, max: 23, names: &[], names_from: 0 };
const DOM: Field = Field { name: "day of month", min: 1, max: 31, names: &[], names_from: 0 };
const MONTH: Field = Field { name: "month", min: 1, max: 12, names: &MONTH_NAMES, names_from: 1 };
// 7 is Sunday too; it's folded onto 0 once parsed.
const DOW: Field = Field { name: "day of week", min: 0, max: 7, names: &DAY_NAMES, names_from: 0 };

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct CronSpec {
    /// The line as written, whitespace collapsed — what the editor shows back.
    pub(crate) source: String,
    minutes: u64,
    hours: u64,
    dom: u64,
    months: u64,
    dow: u64,
    /// A day field written starting with `*` doesn't restrict the day on its
    /// own, so the other field alone decides (the Vixie rule).
    dom_any: bool,
    dow_any: bool,
}

pub(crate) fn parse(expr: &str, min_gap_secs: u64) -> Result<CronSpec, String> {
    let source = expr.split_whitespace().collect::<Vec<_>>().join(" ");
    let lower = source.to_ascii_lowercase();
    let line = MACROS
        .iter()
        .find(|(name, _)| *name == lower)
        .map_or(lower.as_str(), |(_, line)| line);
    if line.starts_with('@') {
        return Err(format!("“{source}” isn't a schedule lpm knows."));
    }
    let parts: Vec<&str> = line.split(' ').collect();
    let [minute, hour, dom, month, dow] = parts.as_slice() else {
        return Err(
            "A cron line has five fields: minute, hour, day of month, month and day of week."
                .into(),
        );
    };
    let mut days = field(dow, &DOW)?;
    if days & (1 << 7) != 0 {
        days = (days | 1) & !(1 << 7);
    }
    let spec = CronSpec {
        minutes: field(minute, &MINUTE)?,
        hours: field(hour, &HOUR)?,
        dom: field(dom, &DOM)?,
        months: field(month, &MONTH)?,
        dow: days,
        dom_any: dom.starts_with('*'),
        dow_any: dow.starts_with('*'),
        source,
    };
    if !spec.has_a_day() {
        return Err("That cron line never runs — no month has that date.".into());
    }
    if (spec.min_gap_minutes() as u64) * 60 < min_gap_secs {
        return Err(format!(
            "A cron job can run at most every {} minutes.",
            min_gap_secs / 60
        ));
    }
    Ok(spec)
}

fn field(text: &str, f: &Field) -> Result<u64, String> {
    let mut bits = 0u64;
    for item in text.split(',') {
        let (range, step) = match item.split_once('/') {
            Some((range, step)) => {
                let step = step.parse::<u32>().ok().filter(|n| *n > 0).ok_or_else(|| {
                    format!("“{item}” needs a whole step above 0 in the {} field.", f.name)
                })?;
                (range, Some(step))
            }
            None => (item, None),
        };
        let (lo, hi) = if range == "*" {
            (f.min, f.max)
        } else if let Some((a, b)) = range.split_once('-') {
            (value(a, f)?, value(b, f)?)
        } else {
            let v = value(range, f)?;
            (v, if step.is_some() { f.max } else { v })
        };
        if lo > hi {
            return Err(format!("“{range}” runs backwards in the {} field.", f.name));
        }
        let mut v = lo;
        while v <= hi {
            bits |= 1 << v;
            v += step.unwrap_or(1);
        }
    }
    Ok(bits)
}

fn value(text: &str, f: &Field) -> Result<u32, String> {
    let n = match text.parse::<u32>() {
        Ok(n) => n,
        Err(_) => match f.names.iter().position(|n| n.eq_ignore_ascii_case(text)) {
            Some(i) => i as u32 + f.names_from,
            None => return Err(format!("“{text}” isn't a valid {}.", f.name)),
        },
    };
    if n < f.min || n > f.max {
        return Err(format!("The {} field takes {}–{}, not {n}.", f.name, f.min, f.max));
    }
    Ok(n)
}

fn has(bits: u64, n: u32) -> bool {
    bits & (1 << n) != 0
}

impl CronSpec {
    fn day_matches(&self, d: NaiveDate) -> bool {
        if !has(self.months, d.month()) {
            return false;
        }
        let dom = has(self.dom, d.day());
        let dow = has(self.dow, d.weekday().num_days_from_sunday());
        if self.dom_any || self.dow_any {
            dom && dow
        } else {
            dom || dow
        }
    }

    /// Whether any date at all satisfies the day fields. Only a restricted day
    /// of month left to decide alone can miss — "the 30th of February".
    fn has_a_day(&self) -> bool {
        // A restricted weekday is in every month, whichever way the days combine.
        if !self.dow_any {
            return true;
        }
        const LONGEST: [u32; 12] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        (1..=12u32)
            .filter(|m| has(self.months, *m))
            .any(|m| (1..=LONGEST[m as usize - 1]).any(|d| has(self.dom, d)))
    }

    /// The shortest wait between two runs, in minutes: between minutes in one
    /// hour, and across the top of the hour when two hours in a row are on.
    fn min_gap_minutes(&self) -> u32 {
        let minutes: Vec<u32> = (0..60).filter(|m| has(self.minutes, *m)).collect();
        let mut gap = minutes.windows(2).map(|w| w[1] - w[0]).min().unwrap_or(u32::MAX);
        let back_to_back = (0..24).any(|h| has(self.hours, h) && has(self.hours, (h + 1) % 24));
        if let (true, Some(first), Some(last)) = (back_to_back, minutes.first(), minutes.last()) {
            gap = gap.min(60 - last + first);
        }
        gap
    }

    fn day_points(&self, d: NaiveDate) -> Vec<i64> {
        let mut points: Vec<i64> = (0..24)
            .filter(|h| has(self.hours, *h))
            .flat_map(|h| (0..60).filter(|m| has(self.minutes, *m)).map(move |m| h * 60 + m))
            .filter_map(|at| crate::jobs::local_epoch(d, at))
            .collect();
        points.sort_unstable();
        points.dedup();
        points
    }

    fn days_from(&self, now: i64, forward: bool) -> impl Iterator<Item = NaiveDate> + '_ {
        let today = chrono::Local
            .timestamp_opt(now, 0)
            .single()
            .map(|t| t.date_naive());
        (0..SEARCH_DAYS)
            .filter_map(move |i| today?.checked_add_signed(Duration::days(if forward { i } else { -i })))
            .filter(|d| self.day_matches(*d))
    }

    /// The first run strictly after `now`.
    pub(crate) fn next_after(&self, now: i64) -> Option<i64> {
        self.days_from(now, true)
            .find_map(|d| self.day_points(d).into_iter().find(|p| *p > now))
    }

    /// The latest run at or before `now`.
    pub(crate) fn last_at_or_before(&self, now: i64) -> Option<i64> {
        self.days_from(now, false)
            .find_map(|d| self.day_points(d).into_iter().rev().find(|p| *p <= now))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jobs::local_epoch;

    const GAP: u64 = 300;

    fn at(y: i32, m: u32, d: u32, h: u32, min: u32) -> i64 {
        local_epoch(NaiveDate::from_ymd_opt(y, m, d).unwrap(), h * 60 + min).unwrap()
    }

    #[test]
    fn reads_lists_ranges_steps_and_names() {
        let s = parse("15 9-17/4 * jan,JUL MON-fri", GAP).unwrap();
        assert_eq!(s.minutes, 1 << 15);
        assert_eq!(s.hours, (1 << 9) | (1 << 13) | (1 << 17));
        assert_eq!(s.months, (1 << 1) | (1 << 7));
        assert_eq!(s.dow, 0b0111110);
        assert!(s.dom_any && !s.dow_any);
    }

    #[test]
    fn folds_seven_onto_sunday_and_expands_shorthands() {
        assert_eq!(parse("0 0 * * 7", GAP).unwrap().dow, 1);
        assert_eq!(parse("0 0 * * 5-7", GAP).unwrap().dow, 0b1100001);
        let weekly = parse("@weekly", GAP).unwrap();
        assert_eq!(weekly.source, "@weekly");
        assert_eq!(weekly.dow, 1);
        assert!(parse("@reboot", GAP).is_err());
    }

    #[test]
    fn refuses_lines_that_are_malformed_too_frequent_or_impossible() {
        assert!(parse("0 9 * *", GAP).unwrap_err().contains("five fields"));
        assert!(parse("60 9 * * *", GAP).unwrap_err().contains("0–59"));
        assert!(parse("0 17-9 * * *", GAP).unwrap_err().contains("backwards"));
        assert!(parse("*/0 * * * *", GAP).unwrap_err().contains("step"));
        assert!(parse("0 9 * * funday", GAP).unwrap_err().contains("funday"));
        assert!(parse("* * * * *", GAP).unwrap_err().contains("every 5 minutes"));
        assert!(parse("58,2 * * * *", GAP).is_err());
        assert!(parse("*/5 * * * *", GAP).is_ok());
        assert!(parse("58,2 9 * * *", GAP).is_ok());
        assert!(parse("0 0 30 2 *", GAP).unwrap_err().contains("never runs"));
        assert!(parse("0 0 29 2 *", GAP).is_ok());
    }

    #[test]
    fn finds_the_next_and_the_last_run() {
        // Friday 2026-07-10, 12:00.
        let s = parse("0 18 * * 5", GAP).unwrap();
        let noon = at(2026, 7, 10, 12, 0);
        assert_eq!(s.next_after(noon), Some(at(2026, 7, 10, 18, 0)));
        assert_eq!(s.next_after(at(2026, 7, 10, 18, 0)), Some(at(2026, 7, 17, 18, 0)));
        assert_eq!(s.last_at_or_before(noon), Some(at(2026, 7, 3, 18, 0)));
        assert_eq!(s.last_at_or_before(at(2026, 7, 10, 18, 0)), Some(at(2026, 7, 10, 18, 0)));
    }

    #[test]
    fn either_day_field_is_enough_when_both_are_set() {
        // The 1st, or any Monday: Wed 2026-07-01, then Mon 2026-07-06.
        let s = parse("0 9 1 * mon", GAP).unwrap();
        let start = at(2026, 6, 30, 12, 0);
        let first = s.next_after(start).unwrap();
        assert_eq!(first, at(2026, 7, 1, 9, 0));
        assert_eq!(s.next_after(first), Some(at(2026, 7, 6, 9, 0)));
        // A starred day of month leaves the weekday alone in charge.
        let odd = parse("0 9 */2 * mon", GAP).unwrap();
        assert_eq!(odd.next_after(start), Some(at(2026, 7, 13, 9, 0)));
    }

    #[test]
    fn reaches_a_leap_day_years_away() {
        let s = parse("0 0 29 2 *", GAP).unwrap();
        assert_eq!(s.next_after(at(2026, 7, 1, 0, 0)), Some(at(2028, 2, 29, 0, 0)));
    }
}
