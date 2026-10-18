use super::*;

fn entry(name: &str, is_dir: bool) -> DirEntryInfo {
    DirEntryInfo {
        name: name.into(),
        is_dir,
        is_symlink: false,
        is_ignored: false,
    }
}

fn changed(path: &str, status: &str) -> ChangedFile {
    ChangedFile {
        path: path.into(),
        status: status.into(),
        staged: false,
    }
}

#[test]
fn folders_come_first_then_names_in_natural_order() {
    let mut list = vec![
        entry("file10.ts", false),
        entry("b", true),
        entry("File2.ts", false),
        entry("A", true),
        entry("file1.ts", false),
    ];
    list.sort_by(compare_entries);
    let names: Vec<&str> = list.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, ["A", "b", "file1.ts", "File2.ts", "file10.ts"]);
}

#[test]
fn leading_zeros_and_case_still_order_stably() {
    assert_eq!(natural_cmp("a01", "a1"), Ordering::Equal);
    assert_eq!(natural_cmp("a2", "a10"), Ordering::Less);
    assert_eq!(natural_cmp("Zeta", "alpha"), Ordering::Greater);
    assert_eq!(natural_cmp("é", "e"), Ordering::Greater);
}

#[test]
fn a_changed_file_carries_its_status_and_a_folder_its_count() {
    let changes = [
        changed("src/app/page.tsx", "modified"),
        changed("src/app/checkout/pay.tsx", "added"),
        changed("src/app/checkout/tax.ts", "modified"),
        changed("src/application.ts", "modified"),
    ];
    let file = entry_json(&entry("page.tsx", false), "src/app/page.tsx", &changes);
    assert_eq!(file["status"], "modified");
    assert!(file.get("changed").is_none());

    let folder = entry_json(&entry("checkout", true), "src/app/checkout", &changes);
    assert_eq!(folder["changed"], 2);
    assert!(folder.get("status").is_none());

    let app = entry_json(&entry("app", true), "src/app", &changes);
    assert_eq!(app["changed"], 3);

    let clean = entry_json(&entry("README.md", false), "README.md", &changes);
    assert_eq!(
        clean,
        json!({ "name": "README.md", "dir": false, "ignored": false })
    );
}
