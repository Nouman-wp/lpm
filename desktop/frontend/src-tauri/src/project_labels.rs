//! The names projects show under — their label, else their file name — so a
//! rename can't give two projects the same one.

use std::path::Path;

#[derive(serde::Deserialize)]
struct LabelOnly {
    #[serde(default)]
    label: String,
}

fn shown_name(path: &Path, file_name: &str) -> String {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_norway::from_slice::<LabelOnly>(&bytes).ok())
        .map(|y| y.label.trim().to_string())
        .filter(|label| !label.is_empty())
        .unwrap_or_else(|| file_name.to_string())
}

fn taken_in(dir: &Path, project: &str, label: &str) -> Option<String> {
    let wanted = label.trim().to_lowercase();
    std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|e| e.to_str()) == Some("yml"))
        .find_map(|path| {
            let name = path.file_stem()?.to_str()?.to_string();
            (name != project && shown_name(&path, &name).to_lowercase() == wanted).then_some(name)
        })
}

/// The other project already shown as `label`, ignoring case.
pub(crate) fn taken_by(project: &str, label: &str) -> Option<String> {
    taken_in(&crate::config::projects_dir(), project, label)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir_with(projects: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, body) in projects {
            std::fs::write(dir.path().join(format!("{name}.yml")), body).unwrap();
        }
        dir
    }

    #[test]
    fn another_projects_label_or_file_name_is_taken() {
        let dir = dir_with(&[
            ("docs-site", "name: docs-site\n"),
            ("pay", "name: pay\nlabel: Payments\n"),
            ("store", "name: store\n"),
        ]);
        assert_eq!(taken_in(dir.path(), "store", "docs-site"), Some("docs-site".into()));
        assert_eq!(taken_in(dir.path(), "store", " payments "), Some("pay".into()));
        assert_eq!(taken_in(dir.path(), "store", "pay"), None);
        assert_eq!(taken_in(dir.path(), "store", "Storefront"), None);
    }

    #[test]
    fn a_project_never_clashes_with_itself() {
        let dir = dir_with(&[("store", "name: store\nlabel: Shop\n")]);
        assert_eq!(taken_in(dir.path(), "store", "shop"), None);
        assert_eq!(taken_in(dir.path(), "store", "store"), None);
    }
}
