use super::*;

fn row(machine: Option<&str>, at: i64, seq: i64) -> HistoryRow {
    HistoryRow {
        seq,
        id: format!("{}-{seq}", machine.unwrap_or("local")),
        text: String::new(),
        project_name: "lpm".into(),
        terminal_id: String::new(),
        terminal_label: String::new(),
        at,
        favorite: false,
        folder_id: None,
        is_draft: false,
        images: json!({}),
        machine: machine.map(str::to_string),
        machine_name: None,
    }
}

// What one computer's message_history_query answers for a page.
fn source_page(rows: &[HistoryRow], input: &QueryInput) -> Vec<HistoryRow> {
    let mut page: Vec<HistoryRow> = rows
        .iter()
        .filter(|r| match (input.cursor_at, input.cursor_seq) {
            (Some(at), Some(seq)) => r.at < at || (r.at == at && r.seq < seq),
            _ => true,
        })
        .map(|r| row(r.machine.as_deref(), r.at, r.seq))
        .collect();
    page.sort_by(|a, b| b.at.cmp(&a.at).then(b.seq.cmp(&a.seq)));
    page.truncate(input.limit as usize);
    page
}

#[test]
fn splits_only_marked_names() {
    assert_eq!(
        split_peer_name("peer-0a1b2c3d-lpm"),
        Some(("0a1b2c3d", "lpm"))
    );
    assert_eq!(
        split_peer_name("peer-0a1b2c3d-my-app"),
        Some(("0a1b2c3d", "my-app"))
    );
    assert_eq!(split_peer_name("peer-review-tool"), None);
    assert_eq!(split_peer_name("peer-0A1B2C3D-lpm"), None);
    assert_eq!(split_peer_name("lpm"), None);
    assert_eq!(raw_name("peer-0a1b2c3d-lpm"), "lpm");
    assert_eq!(raw_name("lpm"), "lpm");
}

#[test]
fn names_a_peer_row_as_this_computer_sees_it() {
    let mut own = row(None, 1, 1);
    own.folder_id = Some("folder".into());
    let own = from_peer("0a1b2c3d", "MacBook", own);
    assert_eq!(own.id, "peer-0a1b2c3d-local-1");
    assert_eq!(own.project_name, "peer-0a1b2c3d-lpm");
    assert_eq!(own.folder_id, None);
    assert_eq!(own.machine.as_deref(), Some("0a1b2c3d"));
    assert_eq!(own.machine_name.as_deref(), Some("MacBook"));

    let mut typed_into_a_host = row(None, 1, 2);
    typed_into_a_host.project_name = "peer-99999999-lpm".into();
    assert_eq!(
        from_peer("0a1b2c3d", "MacBook", typed_into_a_host).project_name,
        "lpm"
    );
}

#[test]
fn pages_through_every_computer_once_in_order() {
    let sources: Vec<(&str, Vec<HistoryRow>)> = vec![
        (
            LOCAL,
            vec![
                row(None, 10, 1),
                row(None, 20, 2),
                row(None, 20, 3),
                row(None, 40, 4),
            ],
        ),
        (
            "0a1b2c3d",
            vec![
                row(Some("0a1b2c3d"), 20, 7),
                row(Some("0a1b2c3d"), 20, 8),
                row(Some("0a1b2c3d"), 30, 9),
            ],
        ),
        (
            "ffffffff",
            vec![row(Some("ffffffff"), 5, 1), row(Some("ffffffff"), 20, 2)],
        ),
    ];
    let mut expected: Vec<HistoryRow> = sources
        .iter()
        .flat_map(|(_, rows)| rows.iter())
        .map(|r| row(r.machine.as_deref(), r.at, r.seq))
        .collect();
    expected.sort_by(page_order);

    let mut input = QueryInput {
        limit: 2,
        machines: true,
        ..Default::default()
    };
    let mut seen = Vec::new();
    loop {
        let mut page: Vec<HistoryRow> = sources
            .iter()
            .flat_map(|(key, rows)| source_page(rows, &input_for(&input, key)))
            .collect();
        page.sort_by(page_order);
        page.truncate(input.limit as usize);
        let Some(last) = page.last() else { break };
        input.cursor_at = Some(last.at);
        input.cursor_seq = Some(last.seq);
        input.cursor_machine = last.machine.clone();
        seen.extend(page.iter().map(|r| r.id.clone()));
    }
    assert_eq!(
        seen,
        expected.iter().map(|r| r.id.clone()).collect::<Vec<_>>()
    );
}

#[test]
fn asks_a_peer_for_the_project_by_its_own_name_and_never_to_fan_out() {
    let input = QueryInput {
        scope: "project".into(),
        project_name: "peer-0a1b2c3d-lpm".into(),
        machines: true,
        cursor_at: Some(20),
        cursor_seq: Some(3),
        ..Default::default()
    };
    let asked = input_for(&input, "0a1b2c3d");
    assert_eq!(asked.project_name, "lpm");
    assert!(!asked.machines);
    assert_eq!(
        (asked.cursor_at, asked.cursor_seq),
        (Some(20), Some(i64::MAX))
    );
    assert_eq!(input_for(&input, LOCAL).cursor_seq, Some(3));
}

#[test]
fn keeps_a_folder_to_this_computer() {
    assert!(is_folder("3f1c"));
    assert!(!is_folder(""));
    assert!(!is_folder("all"));
    assert!(!is_folder("favorites"));
    assert!(!is_folder("drafts"));
}
