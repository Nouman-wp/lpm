// Where an automation is kept follows where it runs, as in the app's editor:
// exactly one project keeps it in that project's own config (a duplicate only
// runs automations from its own config), anything wider in global.yml. So
// changing where it runs can move it between the two; its runs stay with it.
use crate::config::Ctx;
use crate::error::RunError;
use crate::job::{ensure_ok, request_value};
use crate::job_edit::{read_body, save, Definition, GLOBAL, PROJECT};
use serde_norway::{Mapping, Value};

/// The entry for an automation running in `projects` (None for every project).
pub(crate) fn home_of(id: &str, projects: &Option<Vec<String>>) -> Definition {
    match projects.as_deref() {
        Some([only]) => Definition {
            source: PROJECT.into(),
            project: only.clone(),
            id: id.to_string(),
        },
        _ => Definition {
            source: GLOBAL.into(),
            project: String::new(),
            id: id.to_string(),
        },
    }
}

/// A global.yml entry names its projects; a project's own entry doesn't.
pub(crate) fn write_projects(
    body: &mut Mapping,
    home: &Definition,
    projects: &Option<Vec<String>>,
) {
    match projects {
        Some(list) if home.source == GLOBAL => {
            let names = list.iter().cloned().map(Value::String).collect();
            body.insert("projects".into(), Value::Sequence(names));
        }
        _ => {
            body.shift_remove("projects");
        }
    }
}

/// Save `body` where the new scope keeps it, moving it out of `from` when that
/// is somewhere else.
pub(crate) fn rescope(
    ctx: &Ctx,
    from: Definition,
    mut body: Mapping,
    projects: Option<Vec<String>>,
    as_json: bool,
) -> Result<(), RunError> {
    if from.source == "repo" {
        return Err(RunError::NotFound(format!(
            "automation {} lives in {}, which travels with the folder; change where it runs there",
            from.id,
            from.place()
        )));
    }
    let to = home_of(&from.id, &projects);
    write_projects(&mut body, &to, &projects);
    if to.source == from.source && to.project == from.project {
        return save(ctx, &from, body, "updated", as_json);
    }
    if read_body(ctx, &to).is_ok() {
        return Err(RunError::NotFound(format!(
            "an automation {} already exists in {}; remove or rename one of them first",
            to.id,
            to.place()
        )));
    }
    // Written first so a tick in between sees one of the two, never neither.
    let saved = save(ctx, &to, body, "moved", as_json);
    if read_body(ctx, &to).is_ok() {
        ensure_ok(request_value(
            ctx,
            &format!("delete_job {} --keep-state", from.verb_args()),
        )?)?;
    }
    saved
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_project_keeps_it_in_that_projects_config() {
        let one = home_of("nightly", &Some(vec!["web".into()]));
        assert_eq!(
            (one.source.as_str(), one.project.as_str()),
            (PROJECT, "web")
        );
        for wider in [None, Some(vec![]), Some(vec!["web".into(), "api".into()])] {
            let home = home_of("nightly", &wider);
            assert_eq!((home.source.as_str(), home.project.as_str()), (GLOBAL, ""));
        }
    }

    #[test]
    fn only_a_global_entry_names_its_projects() {
        let mut body = Mapping::new();
        body.insert("projects".into(), Value::Sequence(vec![]));
        let two = Some(vec!["web".to_string(), "api".to_string()]);
        write_projects(&mut body, &home_of("j", &two), &two);
        assert_eq!(
            body.get("projects"),
            Some(&Value::Sequence(vec!["web".into(), "api".into()]))
        );
        let one = Some(vec!["web".to_string()]);
        write_projects(&mut body, &home_of("j", &one), &one);
        assert!(body.get("projects").is_none());
        let none = Some(vec![]);
        write_projects(&mut body, &home_of("j", &none), &none);
        assert_eq!(body.get("projects"), Some(&Value::Sequence(vec![])));
        write_projects(&mut body, &home_of("j", &None), &None);
        assert!(body.get("projects").is_none());
    }
}
