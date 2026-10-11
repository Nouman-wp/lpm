use super::*;

fn d(y: i32, m: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(y, m, day).unwrap()
}

fn list(items: Vec<DayItem>) -> DaysValue {
    DaysValue::List(items)
}

fn text(s: &str) -> DayItem {
    DayItem::Text(s.to_string())
}

fn matching_days(rule: &DateRule, y: i32, m: u32) -> Vec<u32> {
    (1..=31)
        .filter_map(|day| NaiveDate::from_ymd_opt(y, m, day))
        .filter(|date| rule.matches(*date))
        .map(|date| date.day())
        .collect()
}

#[test]
fn weekday_names_stay_weekdays() {
    assert_eq!(
        parse_days(&list(vec![text("thu"), text("mon"), text("thu")]), "").unwrap(),
        ParsedDays::Weekdays(vec![0, 3])
    );
    assert_eq!(parse_days(&DaysValue::default(), "").unwrap(), ParsedDays::Weekdays(vec![]));
    assert!(parse_days(&list(vec![text("monday")]), "").is_err());
}

#[test]
fn dates_of_the_month() {
    let parsed = parse_days(&list(vec![DayItem::Num(15), DayItem::Num(1), text("last")]), "").unwrap();
    assert_eq!(
        parsed,
        ParsedDays::Rule(DateRule::MonthDays {
            days: vec![1, 15],
            last: true,
            fill_short: false
        })
    );
    assert!(parse_days(&list(vec![DayItem::Num(0)]), "").is_err());
    assert!(parse_days(&list(vec![DayItem::Num(32)]), "").is_err());
    assert!(parse_days(&DaysValue::One(DayItem::Num(15)), "").is_ok());
}

#[test]
fn kinds_do_not_mix() {
    assert!(parse_days(&list(vec![text("mon"), DayItem::Num(1)]), "").is_err());
    assert!(parse_days(&list(vec![text("2026-10-20"), DayItem::Num(1)]), "").is_err());
}

#[test]
fn short_months_only_with_dates() {
    let the_31st = list(vec![DayItem::Num(31)]);
    assert!(matches!(
        parse_days(&the_31st, "last").unwrap(),
        ParsedDays::Rule(DateRule::MonthDays { fill_short: true, .. })
    ));
    assert!(parse_days(&the_31st, "sometimes").is_err());
    assert!(parse_days(&list(vec![text("mon")]), "last").is_err());
}

#[test]
fn the_31st_skips_or_moves_in_short_months() {
    let skip = DateRule::MonthDays {
        days: vec![31],
        last: false,
        fill_short: false,
    };
    let fill = DateRule::MonthDays {
        days: vec![31],
        last: false,
        fill_short: true,
    };
    assert_eq!(matching_days(&skip, 2026, 4), Vec::<u32>::new());
    assert_eq!(matching_days(&fill, 2026, 4), vec![30]);
    assert_eq!(matching_days(&fill, 2026, 2), vec![28]);
    assert_eq!(matching_days(&skip, 2026, 5), vec![31]);
}

#[test]
fn last_day_of_the_month() {
    let rule = DateRule::MonthDays {
        days: vec![],
        last: true,
        fill_short: false,
    };
    assert_eq!(matching_days(&rule, 2028, 2), vec![29]);
    assert_eq!(matching_days(&rule, 2026, 12), vec![31]);
}

#[test]
fn positions_in_the_month() {
    let first_mon = parse_days(&DaysValue::One(text("first mon")), "").unwrap();
    let ParsedDays::Rule(first_mon) = first_mon else {
        panic!("expected a rule")
    };
    // October 2026 starts on a Thursday.
    assert_eq!(matching_days(&first_mon, 2026, 10), vec![5]);

    let last_fri = DateRule::Nth {
        nth: LAST,
        of: NthOf::Weekday(4),
    };
    assert_eq!(matching_days(&last_fri, 2026, 10), vec![30]);

    let last_workday = DateRule::Nth {
        nth: LAST,
        of: NthOf::Workday,
    };
    // 31 October 2026 is a Saturday.
    assert_eq!(matching_days(&last_workday, 2026, 10), vec![30]);

    let first_workday = DateRule::Nth {
        nth: 1,
        of: NthOf::Workday,
    };
    // 1 November 2026 is a Sunday.
    assert_eq!(matching_days(&first_workday, 2026, 11), vec![2]);

    let third_day = DateRule::Nth {
        nth: 3,
        of: NthOf::Day,
    };
    assert_eq!(matching_days(&third_day, 2026, 10), vec![3]);

    assert!(parse_days(&DaysValue::One(text("fifth mon")), "").is_err());
    assert!(parse_days(&DaysValue::One(text("first monday please")), "").is_err());
}

#[test]
fn calendar_dates_run_once_each() {
    let parsed = parse_days(&list(vec![text("2026-11-02"), text("2026-10-20")]), "").unwrap();
    let ParsedDays::Rule(rule) = parsed else {
        panic!("expected a rule")
    };
    assert_eq!(rule, DateRule::On(vec![d(2026, 10, 20), d(2026, 11, 2)]));
    assert!(rule.matches(d(2026, 10, 20)));
    assert!(!rule.matches(d(2027, 10, 20)));
}

#[test]
fn at_lists() {
    assert_eq!(AtValue::from("09:00").items(), vec!["09:00"]);
    let many = AtValue::Many(vec!["17:30".into(), " ".into(), "09:00".into()]);
    assert_eq!(many.items(), vec!["17:30", "09:00"]);
    assert!(AtValue::default().is_empty());
}

#[test]
fn interval_limits_open_inside_the_window_only() {
    let limits = IntervalLimits {
        window: Some((9 * 60, 18 * 60)),
        days: vec![0, 1, 2, 3, 4],
    };
    let at = |date: NaiveDate, h: u32, m: u32| crate::jobs::local_epoch(date, h * 60 + m).unwrap();
    // Monday 12 October 2026.
    let monday = d(2026, 10, 12);
    assert!(limits.allows(at(monday, 9, 0)));
    assert!(limits.allows(at(monday, 18, 0)));
    assert!(!limits.allows(at(monday, 18, 1)));
    assert!(!limits.allows(at(monday, 8, 59)));
    assert!(!limits.allows(at(d(2026, 10, 17), 12, 0)));

    assert_eq!(limits.next_open(at(monday, 10, 0)), Some(at(monday, 10, 0)));
    assert_eq!(limits.next_open(at(monday, 7, 0)), Some(at(monday, 9, 0)));
    assert_eq!(limits.next_open(at(monday, 19, 0)), Some(at(d(2026, 10, 13), 9, 0)));
    // Friday evening waits for Monday morning.
    assert_eq!(
        limits.next_open(at(d(2026, 10, 16), 19, 0)),
        Some(at(d(2026, 10, 19), 9, 0))
    );
}

#[test]
fn json_shapes() {
    let mut v = json!({});
    DateRule::MonthDays {
        days: vec![1, 15],
        last: true,
        fill_short: true,
    }
    .write_json(&mut v);
    assert_eq!(v, json!({ "monthDays": [1, 15], "lastDay": true, "shortMonths": "last" }));

    let mut v = json!({});
    DateRule::Nth {
        nth: LAST,
        of: NthOf::Workday,
    }
    .write_json(&mut v);
    assert_eq!(v, json!({ "nth": "last", "nthOf": "weekday" }));

    let mut v = json!({});
    DateRule::On(vec![d(2026, 10, 20)]).write_json(&mut v);
    assert_eq!(v, json!({ "onDates": ["2026-10-20"] }));

    let mut v = json!({});
    IntervalLimits {
        window: Some((540, 1080)),
        days: vec![0, 4],
    }
    .write_json(&mut v);
    assert_eq!(v, json!({ "fromMinutes": 540, "untilMinutes": 1080, "days": ["mon", "fri"] }));
}
