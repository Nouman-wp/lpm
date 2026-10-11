// The calendar vocabulary a job schedule can use beyond "these weekdays at this
// time": several fixed times a day, dates of the month, a position in the month
// ("first mon", "last weekday"), one-off calendar dates, and the hours and days
// an interval job is allowed to run in.
//
// Everything new rides on the two keys older builds already read strictly —
// `at` as a list and `days` holding something other than weekday names — so an
// older lpm meeting one of these schedules refuses the job instead of silently
// running it every day.

use chrono::{Datelike, NaiveDate, TimeZone, Timelike};
use serde::Deserialize;
use serde_json::{json, Value};

pub(crate) const DAY_NAMES: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/// How far a search for a month-based rule's neighbouring occurrence looks
/// either way: "the 31st" with short months skipped can leave 59 days between
/// one run and the next.
pub(crate) const MONTH_LOOKAROUND_DAYS: i64 = 62;

const NTH_WORDS: [&str; 5] = ["first", "second", "third", "fourth", "last"];
const LAST: u8 = 5;

/// `at: "09:00"` or `at: ["09:00", "17:30"]`.
#[derive(Deserialize, Clone, Debug)]
#[serde(untagged)]
pub(crate) enum AtValue {
    One(String),
    Many(Vec<String>),
}

impl Default for AtValue {
    fn default() -> Self {
        AtValue::One(String::new())
    }
}

impl From<&str> for AtValue {
    fn from(s: &str) -> Self {
        AtValue::One(s.to_string())
    }
}

impl AtValue {
    pub(crate) fn items(&self) -> Vec<&str> {
        match self {
            AtValue::One(s) => vec![s.trim()],
            AtValue::Many(v) => v.iter().map(|s| s.trim()).collect(),
        }
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect()
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.items().is_empty()
    }
}

#[derive(Deserialize, Clone, Debug)]
#[serde(untagged)]
pub(crate) enum DayItem {
    Num(i64),
    Text(String),
}

/// `days` is a list of weekday names (`[mon, thu]`), dates of the month
/// (`[1, 15, last]`), calendar dates (`[2026-10-20]`), or one position in the
/// month (`first mon`, `last weekday`).
#[derive(Deserialize, Clone, Debug)]
#[serde(untagged)]
pub(crate) enum DaysValue {
    List(Vec<DayItem>),
    One(DayItem),
}

impl Default for DaysValue {
    fn default() -> Self {
        DaysValue::List(Vec::new())
    }
}

impl FromIterator<String> for DaysValue {
    fn from_iter<I: IntoIterator<Item = String>>(iter: I) -> Self {
        DaysValue::List(iter.into_iter().map(DayItem::Text).collect())
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum NthOf {
    Weekday(u8),
    Day,
    Workday,
}

/// Which days a calendar job runs on when that isn't a set of weekdays.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum DateRule {
    /// Dates of the month. `last` adds each month's last day; `fill_short` runs
    /// a date the month doesn't have (the 31st in April) on its last day instead
    /// of skipping that month.
    MonthDays {
        days: Vec<u32>,
        last: bool,
        fill_short: bool,
    },
    /// The first … fourth or last weekday, day or workday of each month.
    Nth { nth: u8, of: NthOf },
    /// Particular calendar dates; each runs once.
    On(Vec<NaiveDate>),
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum ParsedDays {
    /// Weekday numbers (0 = Mon .. 6 = Sun), sorted; empty means every day.
    Weekdays(Vec<u8>),
    Rule(DateRule),
}

pub(crate) fn parse_day(d: &str) -> Result<u8, String> {
    let d = d.trim().to_lowercase();
    DAY_NAMES
        .iter()
        .position(|n| *n == d)
        .map(|i| i as u8)
        .ok_or_else(|| format!("\"{d}\" isn't a valid day."))
}

fn parse_nth(text: &str) -> Option<DateRule> {
    let mut words = text.split_whitespace();
    let (nth, of) = (words.next()?, words.next()?);
    if words.next().is_some() {
        return None;
    }
    let nth = NTH_WORDS.iter().position(|w| *w == nth)? as u8 + 1;
    let of = match of {
        "day" => NthOf::Day,
        "weekday" => NthOf::Workday,
        d => NthOf::Weekday(parse_day(d).ok()?),
    };
    Some(DateRule::Nth { nth, of })
}

enum Kind {
    Weekday(u8),
    Date(u32),
    Last,
    On(NaiveDate),
}

fn classify(item: &DayItem) -> Result<Kind, String> {
    let date = |n: i64| {
        if (1..=31).contains(&n) {
            Ok(Kind::Date(n as u32))
        } else {
            Err("Dates of the month run from 1 to 31.".to_string())
        }
    };
    match item {
        DayItem::Num(n) => date(*n),
        DayItem::Text(raw) => {
            let t = raw.trim().to_lowercase();
            if t == "last" {
                return Ok(Kind::Last);
            }
            if let Ok(n) = t.parse::<i64>() {
                return date(n);
            }
            if let Ok(d) = NaiveDate::parse_from_str(&t, "%Y-%m-%d") {
                return Ok(Kind::On(d));
            }
            parse_day(&t).map(Kind::Weekday)
        }
    }
}

/// Reads `days` and the `shortMonths` setting that goes with dates of the month.
pub(crate) fn parse_days(value: &DaysValue, short_months: &str) -> Result<ParsedDays, String> {
    let items: Vec<&DayItem> = match value {
        DaysValue::List(v) => v.iter().collect(),
        DaysValue::One(item) => vec![item],
    };
    if let [DayItem::Text(t)] = items.as_slice() {
        let t = t.trim().to_lowercase();
        if t.contains(char::is_whitespace) {
            let rule = parse_nth(&t)
                .ok_or("Use a position like \"first mon\" or \"last weekday\".")?;
            return finish(ParsedDays::Rule(rule), short_months);
        }
    }

    let (mut weekdays, mut dates, mut last, mut on) = (Vec::new(), Vec::new(), false, Vec::new());
    for item in items {
        match classify(item)? {
            Kind::Weekday(d) => weekdays.push(d),
            Kind::Date(d) => dates.push(d),
            Kind::Last => last = true,
            Kind::On(d) => on.push(d),
        }
    }
    let kinds = [!weekdays.is_empty(), !dates.is_empty() || last, !on.is_empty()]
        .iter()
        .filter(|k| **k)
        .count();
    if kinds > 1 {
        return Err("Use weekdays, dates of the month or calendar dates — not a mix.".into());
    }
    let parsed = if !on.is_empty() {
        on.sort_unstable();
        on.dedup();
        ParsedDays::Rule(DateRule::On(on))
    } else if !dates.is_empty() || last {
        dates.sort_unstable();
        dates.dedup();
        ParsedDays::Rule(DateRule::MonthDays {
            days: dates,
            last,
            fill_short: false,
        })
    } else {
        // Week order, not the order they were written in: a weekly pick draws
        // from this list by position, so the days a job lands on must not depend
        // on how its config happened to spell them.
        weekdays.sort_unstable();
        weekdays.dedup();
        ParsedDays::Weekdays(weekdays)
    };
    finish(parsed, short_months)
}

fn finish(parsed: ParsedDays, short_months: &str) -> Result<ParsedDays, String> {
    let fill = match short_months.trim().to_lowercase().as_str() {
        "" => None,
        "skip" => Some(false),
        "last" => Some(true),
        _ => return Err("shortMonths is either \"skip\" or \"last\".".into()),
    };
    match (parsed, fill) {
        (ParsedDays::Rule(DateRule::MonthDays { days, last, .. }), fill) => {
            Ok(ParsedDays::Rule(DateRule::MonthDays {
                days,
                last,
                fill_short: fill.unwrap_or(false),
            }))
        }
        (_, Some(_)) => Err("shortMonths only goes with dates of the month.".into()),
        (parsed, None) => Ok(parsed),
    }
}

fn days_in_month(date: NaiveDate) -> u32 {
    let (y, m) = (date.year(), date.month());
    let next = if m == 12 {
        NaiveDate::from_ymd_opt(y + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(y, m + 1, 1)
    };
    next.and_then(|n| n.pred_opt()).map(|d| d.day()).unwrap_or(28)
}

fn weekday_of(date: NaiveDate) -> u8 {
    date.weekday().num_days_from_monday() as u8
}

fn nth_matches(date: NaiveDate, nth: u8, of: NthOf) -> bool {
    let dim = days_in_month(date);
    let d = date.day();
    match of {
        NthOf::Day => d == if nth == LAST { dim } else { nth as u32 },
        NthOf::Weekday(w) => {
            weekday_of(date) == w
                && if nth == LAST {
                    d + 7 > dim
                } else {
                    (d - 1) / 7 + 1 == nth as u32
                }
        }
        NthOf::Workday => {
            if weekday_of(date) >= 5 {
                return false;
            }
            let workdays: Vec<u32> = (1..=dim)
                .filter(|day| {
                    date.with_day(*day)
                        .is_some_and(|x| weekday_of(x) < 5)
                })
                .collect();
            let pick = if nth == LAST {
                workdays.last()
            } else {
                workdays.get(nth as usize - 1)
            };
            pick == Some(&d)
        }
    }
}

impl DateRule {
    pub(crate) fn matches(&self, date: NaiveDate) -> bool {
        match self {
            DateRule::MonthDays {
                days,
                last,
                fill_short,
            } => {
                let dim = days_in_month(date);
                let d = date.day();
                days.contains(&d)
                    || (d == dim && (*last || (*fill_short && days.iter().any(|x| *x > dim))))
            }
            DateRule::Nth { nth, of } => nth_matches(date, *nth, *of),
            DateRule::On(dates) => dates.contains(&date),
        }
    }

    pub(crate) fn write_json(&self, v: &mut Value) {
        match self {
            DateRule::MonthDays {
                days,
                last,
                fill_short,
            } => {
                v["monthDays"] = json!(days);
                if *last {
                    v["lastDay"] = json!(true);
                }
                if *fill_short {
                    v["shortMonths"] = json!("last");
                }
            }
            DateRule::Nth { nth, of } => {
                v["nth"] = json!(NTH_WORDS[*nth as usize - 1]);
                v["nthOf"] = json!(match of {
                    NthOf::Weekday(w) => DAY_NAMES[*w as usize],
                    NthOf::Day => "day",
                    NthOf::Workday => "weekday",
                });
            }
            DateRule::On(dates) => {
                let list: Vec<String> = dates.iter().map(|d| d.format("%Y-%m-%d").to_string()).collect();
                v["onDates"] = json!(list);
            }
        }
    }
}

/// When an interval job may start a run: inside a daily window (minutes since
/// midnight, both ends included) and on some weekdays. Either may be absent.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct IntervalLimits {
    pub(crate) window: Option<(u32, u32)>,
    pub(crate) days: Vec<u8>,
}

impl IntervalLimits {
    fn day_ok(&self, date: NaiveDate) -> bool {
        self.days.is_empty() || self.days.contains(&weekday_of(date))
    }

    pub(crate) fn allows(&self, at: i64) -> bool {
        let Some(t) = chrono::Local.timestamp_opt(at, 0).single() else {
            return true;
        };
        let minute = t.hour() * 60 + t.minute();
        self.day_ok(t.date_naive())
            && self.window.is_none_or(|(from, until)| minute >= from && minute <= until)
    }

    /// The first moment at or after `at` a run may start.
    pub(crate) fn next_open(&self, at: i64) -> Option<i64> {
        if self.allows(at) {
            return Some(at);
        }
        let today = chrono::Local.timestamp_opt(at, 0).single()?.date_naive();
        let open_min = self.window.map(|(from, _)| from).unwrap_or(0);
        (0..8)
            .map(|i| today + chrono::Duration::days(i))
            .filter(|d| self.day_ok(*d))
            .filter_map(|d| crate::jobs::local_epoch(d, open_min))
            .find(|open| *open >= at)
    }

    pub(crate) fn write_json(&self, v: &mut Value) {
        if let Some((from, until)) = self.window {
            v["fromMinutes"] = json!(from);
            v["untilMinutes"] = json!(until);
        }
        if !self.days.is_empty() {
            let days: Vec<&str> = self.days.iter().map(|d| DAY_NAMES[*d as usize]).collect();
            v["days"] = json!(days);
        }
    }
}

#[cfg(test)]
#[path = "jobcal_tests.rs"]
mod tests;
