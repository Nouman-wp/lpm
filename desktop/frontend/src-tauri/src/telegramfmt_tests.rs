use super::*;

fn html(markdown: &str) -> String {
    let mut sent = messages("Done", Some(markdown), 4000);
    assert_eq!(sent.len(), 1);
    sent.remove(0).html.trim_start_matches("<b>Done</b>\n\n").to_string()
}

#[test]
fn renders_an_agent_report_the_way_telegram_shows_it() {
    let report = "## Your X feed, last ~24 hours\n\n**Bitcoin and markets** (almost the whole feed)\n- ⚑ **@saylor**: \"There's always room for more orange.\" https://x.com/saylor/status/2109253809176232059\n- ⚑ **@BitcoinArchive**: back above **$83,000** after the dip.";
    assert_eq!(
        html(report),
        "<b>Your X feed, last ~24 hours</b>\n\n<b>Bitcoin and markets</b> (almost the whole feed)\n• ⚑ <b>@saylor</b>: \"There's always room for more orange.\" https://x.com/saylor/status/2109253809176232059\n• ⚑ <b>@BitcoinArchive</b>: back above <b>$83,000</b> after the dip."
    );
}

#[test]
fn escapes_what_telegram_would_read_as_markup() {
    assert_eq!(html("a < b && c > d"), "a &lt; b &amp;&amp; c &gt; d");
    assert_eq!(html("`<div>` & <b>"), "<code>&lt;div&gt;</code> &amp; &lt;b&gt;");
    assert_eq!(html(r"not \*italic\*"), "not *italic*");
}

#[test]
fn inline_spans() {
    assert_eq!(html("*it* _it_ ***both*** ~~gone~~"), "<i>it</i> <i>it</i> <b><i>both</i></b> <s>gone</s>");
    assert_eq!(html("[the post](https://x.com/a?b=1&c=\"2\")"), "<a href=\"https://x.com/a?b=1&amp;c=&quot;2&quot;\">the post</a>");
    assert_eq!(html("<https://lpm.cx>"), "<a href=\"https://lpm.cx\">https://lpm.cx</a>");
    assert_eq!(html("see [the file](src/main.rs)"), "see the file (src/main.rs)");
}

#[test]
fn leaves_lookalikes_alone() {
    assert_eq!(html("snake_case_name and @user_name_2"), "snake_case_name and @user_name_2");
    assert_eq!(html("https://x.com/a_b_c/**x** done"), "https://x.com/a_b_c/**x** done");
    assert_eq!(html("2 * 3 * 4 and ~24 hours"), "2 * 3 * 4 and ~24 hours");
    assert_eq!(html("**unclosed"), "**unclosed");
}

#[test]
fn keeps_spans_out_of_places_telegram_refuses_them() {
    assert_eq!(html("**run `make`**"), "<b>run make</b>");
    assert_eq!(html("[`lpm` docs](https://lpm.cx)"), "<a href=\"https://lpm.cx\">lpm docs</a>");
    assert_eq!(html("**[bold link](https://lpm.cx)**"), "<b><a href=\"https://lpm.cx\">bold link</a></b>");
    assert_eq!(
        html("> quoted **bold** [link](https://lpm.cx) `code`"),
        "<blockquote>quoted <b>bold</b> link (https://lpm.cx) code</blockquote>"
    );
}

#[test]
fn blocks() {
    assert_eq!(html("# Title ##"), "<b>Title</b>");
    assert_eq!(html("1. first\n  - nested\n- [ ] todo\n- [x] done"), "1. first\n  • nested\n• ☐ todo\n• ☑ done");
    assert_eq!(html("above\n\n---\n\nbelow"), "above\n\n──────────\n\nbelow");
    assert_eq!(html("> one\n> two\nafter"), "<blockquote>one\ntwo</blockquote>\nafter");
    assert_eq!(
        html("```rust\nlet x = a < b;\n```"),
        "<pre><code class=\"language-rust\">let x = a &lt; b;</code></pre>"
    );
    assert_eq!(html("```\n**not bold**\n```"), "<pre>**not bold**</pre>");
    assert_eq!(html("| a | b |\n|---|---|\n| 1 | 2 |"), "<pre>| a | b |\n|---|---|\n| 1 | 2 |</pre>");
}

#[test]
fn heads_the_report_and_keeps_its_source_as_the_fallback() {
    let sent = messages("✅ \"Watch\" & co is done.", Some("**Two** new models.\n"), 4000);
    assert_eq!(
        sent,
        vec![Message {
            html: "<b>✅ \"Watch\" &amp; co is done.</b>\n\n<b>Two</b> new models.".into(),
            plain: "✅ \"Watch\" & co is done.\n\n**Two** new models.".into(),
        }]
    );
    assert_eq!(messages("Done", Some("  "), 4000), messages("Done", None, 4000));
    assert_eq!(messages("Done", None, 4000)[0].html, "<b>Done</b>");
}

#[test]
fn splits_long_reports_between_blocks_and_inside_code() {
    let report = format!("{}\n\n```\n{}\n```", "word ".repeat(10).trim(), "line\n".repeat(30).trim());
    let sent = messages("Done", Some(&report), 60);
    assert!(sent.len() > 2);
    for message in &sent {
        assert!(visible_len(&message.html) <= 60, "{message:?}");
        assert_eq!(message.html.matches("<pre>").count(), message.html.matches("</pre>").count());
    }
    assert!(sent.iter().skip(1).all(|m| m.html.starts_with("<pre>")));

    let long_line = "x".repeat(25);
    let sent = messages("Done", Some(&long_line), 10);
    assert_eq!(sent.iter().map(|m| m.plain.as_str()).collect::<Vec<_>>(), vec!["Done", "xxxxxxxxxx", "xxxxxxxxxx", "xxxxx"]);
}
