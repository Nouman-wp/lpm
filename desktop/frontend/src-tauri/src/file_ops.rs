// The Files tab's edits to the tree: a new file or folder, a rename, a move to
// the Trash. Every path is project-relative and has to land inside the root
// with its folders' symlinks resolved, so no edit reaches past the folder the
// tab shows. The entry itself is never resolved: a symlink is renamed or
// trashed as the link, not as what it points to.
use crate::config::expand_home;
use crate::file_browser::{checked_rel, HIDDEN_DIRS};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

fn canonical_root(root: &str) -> Result<PathBuf, String> {
    if root.trim().is_empty() {
        return Err("empty project root".into());
    }
    crate::files::refuse_remote_write(root)?;
    let base = expand_home(root);
    let canon = dunce::canonicalize(&base).map_err(|e| format!("cannot open {base}: {e}"))?;
    if !canon.is_dir() {
        return Err(format!("not a folder: {base}"));
    }
    Ok(canon)
}

/// The entry `rel` names under `root`, and its name.
fn entry_path(root: &Path, rel: &str) -> Result<(PathBuf, String), String> {
    let rel = checked_rel(rel)?;
    let (dir, name) = rel.rsplit_once('/').unwrap_or(("", rel.as_str()));
    if name.is_empty() {
        return Err("no file or folder named".into());
    }
    if rel.split('/').any(|part| HIDDEN_DIRS.contains(&part)) {
        return Err(format!(
            "{rel} is part of version control and stays as it is"
        ));
    }
    let parent =
        dunce::canonicalize(root.join(dir)).map_err(|e| format!("cannot open {dir}: {e}"))?;
    if !parent.starts_with(root) {
        return Err(format!("{rel} is outside the project"));
    }
    Ok((parent.join(name), name.to_string()))
}

fn checked_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Enter a name".into());
    }
    if name == "." || name == ".." {
        return Err(format!("\"{name}\" isn't a valid name"));
    }
    if name.contains(['/', '\\']) {
        return Err("A name can't contain / or \\".into());
    }
    if name.chars().any(char::is_control) {
        return Err("A name can't contain control characters".into());
    }
    #[cfg(windows)]
    if let Some(problem) = windows_name_problem(name) {
        return Err(problem);
    }
    Ok(())
}

#[cfg(any(windows, test))]
fn windows_name_problem(name: &str) -> Option<String> {
    if name.contains(['<', '>', ':', '"', '|', '?', '*']) {
        return Some("A name can't contain < > : \" | ? *".into());
    }
    if name.ends_with(['.', ' ']) {
        return Some("A name can't end with a dot or a space".into());
    }
    let stem = name
        .split('.')
        .next()
        .unwrap_or(name)
        .trim_end()
        .to_ascii_uppercase();
    let device = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'));
    device.then(|| format!("\"{name}\" is reserved by Windows"))
}

fn io_message(name: &str, e: std::io::Error) -> String {
    if e.kind() == ErrorKind::AlreadyExists {
        format!("{name} already exists")
    } else {
        format!("{name}: {e}")
    }
}

/// Whether `target` is an entry other than `source`. A case-insensitive disk
/// finds the source under any spelling of its name, so for a new spelling only
/// an entry listed under exactly that name is in the way.
fn taken(target: &Path, source: &Path) -> bool {
    if std::fs::symlink_metadata(target).is_err() {
        return false;
    }
    let (Some(dir), Some(want), Some(have)) =
        (target.parent(), target.file_name(), source.file_name())
    else {
        return true;
    };
    let respelled = source.parent() == Some(dir)
        && want.to_string_lossy().to_lowercase() == have.to_string_lossy().to_lowercase();
    if !respelled {
        return true;
    }
    std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .any(|e| e.file_name() == want)
        })
        .unwrap_or(true)
}

/// A new empty file, or folder, at `rel`. Whatever is already there stays.
#[tauri::command(async)]
pub fn create_project_entry(root: String, rel: String, is_dir: bool) -> Result<(), String> {
    let base = canonical_root(&root)?;
    let (path, name) = entry_path(&base, &rel)?;
    checked_name(&name)?;
    let made = if is_dir {
        std::fs::create_dir(&path)
    } else {
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map(drop)
    };
    made.map_err(|e| io_message(&name, e))?;
    crate::gitmoved::announce(&root);
    Ok(())
}

/// Rename `from` to `to`, or move it to another folder of the project. An
/// entry already at `to` is never replaced.
#[tauri::command(async)]
pub fn rename_project_entry(root: String, from: String, to: String) -> Result<(), String> {
    let base = canonical_root(&root)?;
    let (source, old) = entry_path(&base, &from)?;
    let (target, new) = entry_path(&base, &to)?;
    checked_name(&new)?;
    std::fs::symlink_metadata(&source).map_err(|_| format!("{old} no longer exists"))?;
    if source == target {
        return Ok(());
    }
    if target.starts_with(&source) {
        return Err(format!("Can't move {old} into itself"));
    }
    if taken(&target, &source) {
        return Err(format!("{new} already exists"));
    }
    std::fs::rename(&source, &target).map_err(|e| format!("Couldn't rename {old}: {e}"))?;
    crate::gitmoved::announce(&root);
    Ok(())
}

/// Send `rel` to the host's Trash, or the Recycle Bin on Windows. A host with
/// neither refuses rather than deleting.
#[tauri::command(async)]
pub fn trash_project_entry(root: String, rel: String) -> Result<(), String> {
    let base = canonical_root(&root)?;
    let (path, name) = entry_path(&base, &rel)?;
    std::fs::symlink_metadata(&path).map_err(|_| format!("{name} no longer exists"))?;
    crate::trash::move_to_trash(&path)?;
    crate::gitmoved::announce(&root);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        (dir, root)
    }

    #[test]
    fn creates_files_and_folders_without_replacing_anything() {
        let (dir, root) = project();
        create_project_entry(root.clone(), "src".into(), true).unwrap();
        create_project_entry(root.clone(), "src/main.rs".into(), false).unwrap();
        assert!(dir.path().join("src").is_dir());
        std::fs::write(dir.path().join("src/main.rs"), "fn main() {}").unwrap();
        let again = create_project_entry(root.clone(), "src/main.rs".into(), false);
        assert_eq!(again.unwrap_err(), "main.rs already exists");
        assert_eq!(
            std::fs::read_to_string(dir.path().join("src/main.rs")).unwrap(),
            "fn main() {}"
        );
        assert!(create_project_entry(root.clone(), "src".into(), true).is_err());
        assert!(create_project_entry(root, "missing/a.txt".into(), false).is_err());
    }

    #[test]
    fn refuses_paths_that_leave_the_project() {
        let (_dir, root) = project();
        for rel in ["", "../x", "src/../../x", "/etc/x", ".git/config", "a/.git"] {
            assert!(
                create_project_entry(root.clone(), rel.into(), false).is_err(),
                "{rel} was allowed"
            );
            assert!(trash_project_entry(root.clone(), rel.into()).is_err());
        }
        assert!(create_project_entry(String::new(), "a".into(), false).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_symlinked_folder_that_points_outside() {
        let (dir, root) = project();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("out")).unwrap();
        let err = create_project_entry(root.clone(), "out/x.txt".into(), false).unwrap_err();
        assert!(err.contains("outside the project"), "{err}");
        assert!(!outside.path().join("x.txt").exists());
        std::fs::write(dir.path().join("a.txt"), "").unwrap();
        assert!(rename_project_entry(root.clone(), "a.txt".into(), "out/a.txt".into()).is_err());
        assert!(trash_project_entry(root, "out/anything".into()).is_err());
    }

    #[test]
    fn renames_and_moves_without_clobbering() {
        let (dir, root) = project();
        std::fs::create_dir(dir.path().join("src")).unwrap();
        std::fs::write(dir.path().join("a.txt"), "a").unwrap();
        std::fs::write(dir.path().join("b.txt"), "b").unwrap();
        let err = rename_project_entry(root.clone(), "a.txt".into(), "b.txt".into()).unwrap_err();
        assert_eq!(err, "b.txt already exists");
        assert_eq!(
            std::fs::read_to_string(dir.path().join("b.txt")).unwrap(),
            "b"
        );
        rename_project_entry(root.clone(), "a.txt".into(), "src/c.txt".into()).unwrap();
        assert_eq!(
            std::fs::read_to_string(dir.path().join("src/c.txt")).unwrap(),
            "a"
        );
        assert!(rename_project_entry(root.clone(), "src".into(), "src/inner".into()).is_err());
        assert!(rename_project_entry(root.clone(), "gone.txt".into(), "x.txt".into()).is_err());
        assert!(rename_project_entry(root, "b.txt".into(), "../b.txt".into()).is_err());
    }

    #[test]
    fn a_new_spelling_of_the_same_name_is_a_rename() {
        let (dir, root) = project();
        std::fs::write(dir.path().join("readme.md"), "r").unwrap();
        rename_project_entry(root, "readme.md".into(), "README.md".into()).unwrap();
        let names: Vec<String> = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["README.md".to_string()]);
    }

    #[test]
    fn names_are_one_segment_the_disk_takes() {
        assert!(checked_name("main.rs").is_ok());
        assert!(checked_name(".env").is_ok());
        for bad in ["", "  ", ".", "..", "a\\b", "a/b", "tab\there"] {
            assert!(checked_name(bad).is_err(), "{bad:?} was allowed");
        }
        assert!(windows_name_problem("notes.md").is_none());
        assert!(windows_name_problem("COM10").is_none());
        for bad in [
            "a:b",
            "what?",
            "trailing.",
            "trailing ",
            "CON",
            "nul.txt",
            "com1",
            "LPT9.log",
        ] {
            assert!(windows_name_problem(bad).is_some(), "{bad:?} was allowed");
        }
    }
}
