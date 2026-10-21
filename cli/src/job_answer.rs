// `lpm automations answer`: answer, or dismiss, the question an automation is
// waiting on. With no answer given it shows the question and how to answer it.
use crate::config::Ctx;
use crate::control;
use crate::error::RunError;
use crate::job::{confirm_label, ensure_ok, request_value, value_text};
use crate::job_runtime::{global_row, project_row, target_project, verb_line, Target};
use crate::statussock::{hex_encode, quote_arg};
use crate::util::print_json;
use clap::Args;
use serde_json::{json, Value};

#[derive(Args)]
pub struct AnswerArgs {
    #[command(flatten)]
    target: Target,
    #[arg(long, conflicts_with_all = ["no", "pick", "text", "answers", "dismiss"], help = "Answer a yes/no question with yes")]
    yes: bool,
    #[arg(long, conflicts_with_all = ["pick", "text", "answers", "dismiss"], help = "Answer a yes/no question with no")]
    no: bool,
    #[arg(long, value_name = "LABEL", conflicts_with_all = ["text", "answers", "dismiss"], help = "Pick an option; repeat to pick several")]
    pick: Vec<String>,
    #[arg(long, value_name = "TEXT", conflicts_with_all = ["answers", "dismiss"], help = "Answer in your own words")]
    text: Option<String>,
    #[arg(
        long,
        value_name = "JSON",
        conflicts_with = "dismiss",
        help = "Answers keyed by question id, for a question with several parts"
    )]
    answers: Option<String>,
    #[arg(long, help = "Drop the question without answering it")]
    dismiss: bool,
    #[arg(long)]
    json: bool,
}

/// The open question, and the project its run belongs to.
fn waiting(ctx: &Ctx, target: &Target) -> Result<(String, Value), RunError> {
    control::require_app(ctx)?;
    let row = if target.global {
        global_row(ctx, &target.job_id)?
    } else {
        project_row(ctx, &target_project(ctx, target)?, &target.job_id)?
    };
    let ask = row
        .get("ask")
        .filter(|a| a.is_object())
        .cloned()
        .ok_or_else(|| {
            RunError::NotFound(format!(
                "automation {} isn't waiting for an answer",
                target.job_id
            ))
        })?;
    Ok((value_text(&ask, "project").to_string(), ask))
}

/// The answers the flags give, for a question with one part.
pub(crate) fn answers_from_flags(
    ask: &Value,
    args: &AnswerArgs,
) -> Result<Option<Value>, RunError> {
    if let Some(raw) = &args.answers {
        let v: Value = serde_json::from_str(raw)
            .map_err(|e| RunError::NotFound(format!("--answers isn't valid JSON: {e}")))?;
        return Ok(Some(v));
    }
    let given = if args.yes {
        json!(true)
    } else if args.no {
        json!(false)
    } else if !args.pick.is_empty() {
        json!(args.pick)
    } else if let Some(text) = &args.text {
        json!(text)
    } else {
        return Ok(None);
    };
    let questions = ask
        .get("questions")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let [only] = questions.as_slice() else {
        return Err(RunError::NotFound(
            "this question has several parts — answer them with --answers '{\"<id>\": ...}'".into(),
        ));
    };
    Ok(Some(json!({ value_text(only, "id"): given })))
}

pub(crate) fn describe(ask: &Value) -> String {
    let mut out = String::new();
    for q in ask
        .get("questions")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        out.push_str(&format!(
            "{}  [{}]\n",
            value_text(q, "text"),
            value_text(q, "id")
        ));
        match value_text(q, "type") {
            "confirm" => out.push_str(&format!(
                "  --yes ({})  or  --no ({})\n",
                confirm_label(q, true),
                confirm_label(q, false)
            )),
            "choice" => {
                for o in q
                    .get("options")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    out.push_str(&format!("  --pick {}\n", quote_arg(value_text(o, "label"))));
                }
            }
            _ => out.push_str("  --text \"...\"\n"),
        }
    }
    out
}

pub fn answer(ctx: &Ctx, args: AnswerArgs) -> Result<(), RunError> {
    let job_id = &args.target.job_id;
    let (project, ask) = waiting(ctx, &args.target)?;
    let ask_id = value_text(&ask, "id").to_string();
    let ask_arg = format!("--ask={}", quote_arg(&ask_id));
    let line = if args.dismiss {
        verb_line("dismiss_job_question", &project, job_id, &ask_arg)
    } else {
        let Some(answers) = answers_from_flags(&ask, &args)? else {
            if args.json {
                print_json(&ask);
            } else {
                print!("{}", describe(&ask));
            }
            return Err(RunError::NotFound("give an answer, or --dismiss".into()));
        };
        verb_line(
            "answer_job_question",
            &project,
            job_id,
            &format!(
                "{ask_arg} --answers-hex={}",
                hex_encode(&answers.to_string())
            ),
        )
    };
    ensure_ok(request_value(ctx, &line)?)?;
    let action = if args.dismiss {
        "dismissed"
    } else {
        "answered"
    };
    if args.json {
        print_json(&json!({ "ok": true, "action": action, "automation": job_id, "ask": ask_id }));
    } else {
        println!("{action} the question from automation {job_id}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[derive(Parser)]
    struct Wrap {
        #[command(flatten)]
        args: AnswerArgs,
    }

    fn parse(line: &[&str]) -> AnswerArgs {
        let mut argv = vec!["answer"];
        argv.extend_from_slice(line);
        Wrap::try_parse_from(argv).unwrap().args
    }

    fn one(kind: &str) -> Value {
        json!({ "id": "a1", "questions": [{ "id": "q1", "type": kind, "text": "Go?" }] })
    }

    #[test]
    fn flags_answer_a_one_part_question() {
        assert_eq!(
            answers_from_flags(&one("confirm"), &parse(&["nightly", "--no"])).unwrap(),
            Some(json!({ "q1": false }))
        );
        assert_eq!(
            answers_from_flags(
                &one("choice"),
                &parse(&["nightly", "--pick", "a", "--pick", "b"])
            )
            .unwrap(),
            Some(json!({ "q1": ["a", "b"] }))
        );
        assert_eq!(
            answers_from_flags(&one("text"), &parse(&["nightly"])).unwrap(),
            None
        );
    }

    #[test]
    fn a_question_with_parts_needs_answers_json() {
        let two = json!({ "questions": [{ "id": "q1" }, { "id": "q2" }] });
        assert!(answers_from_flags(&two, &parse(&["nightly", "--yes"])).is_err());
        assert_eq!(
            answers_from_flags(&two, &parse(&["nightly", "--answers", "{\"q1\":true}"])).unwrap(),
            Some(json!({ "q1": true }))
        );
    }

    #[test]
    fn shows_how_to_answer() {
        let ask = json!({ "questions": [
            { "id": "q1", "type": "confirm", "text": "Deploy?", "yes": "Ship" },
            { "id": "q2", "type": "choice", "text": "Where?", "options": [{ "label": "us" }] },
        ]});
        let text = describe(&ask);
        assert!(text.contains("Deploy?  [q1]\n  --yes (Ship)  or  --no (No)"));
        assert!(text.contains("--pick 'us'"));
    }
}
