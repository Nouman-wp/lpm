// Agents reply in Markdown, and Telegram shows it as typed — `**`, `##` and
// all — unless the message comes in one of its own markups. This turns the
// Markdown into the HTML subset Telegram renders (bold, italic, strikethrough,
// code, links, quotes) and spells out what it has no markup for: a heading is a
// bold line, a list item a bullet, a table keeps its columns in monospace.
//
// Telegram refuses a message whose entities nest in ways it doesn't allow:
// nothing may sit inside code, links and quotes take no code or other links, so
// those spans come out as plain text there.

/// One message, with the plain text to send instead if Telegram turns the
/// markup down.
#[derive(Debug, PartialEq)]
pub struct Message {
    pub html: String,
    pub plain: String,
}

struct Block {
    html: String,
    plain: String,
}

impl Block {
    fn text(plain: &str) -> Self {
        Block {
            html: escape(plain),
            plain: plain.to_string(),
        }
    }

    fn is_blank(&self) -> bool {
        self.plain.trim().is_empty()
    }
}

/// `head` is plain text, set in bold over `body`, the agent's Markdown. Each
/// message stays within `max` characters of text.
pub fn messages(head: &str, body: Option<&str>, max: usize) -> Vec<Message> {
    let mut blocks = vec![Block {
        html: format!("<b>{}</b>", escape(head)),
        plain: head.to_string(),
    }];
    if let Some(body) = body.map(str::trim).filter(|b| !b.is_empty()) {
        blocks.push(Block::text(""));
        blocks.extend(blocks_of(body, max));
    }
    pack(blocks, max)
}

fn blocks_of(markdown: &str, max: usize) -> Vec<Block> {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim_start();
        if let Some((fence, lang)) = fence_open(trimmed) {
            let start = i + 1;
            i = start;
            while i < lines.len() && !lines[i].trim().starts_with(fence) {
                i += 1;
            }
            out.extend(preformatted(&lines[start..i.min(lines.len())], lang, max));
            i += 1;
        } else if is_table_row(trimmed) {
            let start = i;
            while i < lines.len() && is_table_row(lines[i].trim_start()) {
                i += 1;
            }
            let rows: Vec<&str> = lines[start..i].iter().map(|l| l.trim()).collect();
            out.extend(preformatted(&rows, "", max));
        } else if quoted(trimmed).is_some() {
            let mut quote = Vec::new();
            while let Some(text) = lines.get(i).and_then(|l| quoted(l.trim_start())) {
                quote.push(text);
                i += 1;
            }
            out.extend(blockquote(&quote, max));
        } else if line.chars().count() > max {
            out.extend(char_chunks(line, max).iter().map(|piece| Block::text(piece)));
            i += 1;
        } else {
            out.push(line_block(line));
            i += 1;
        }
    }
    out
}

fn line_block(line: &str) -> Block {
    let trimmed = line.trim_start();
    let indent = &line[..line.len() - trimmed.len()];
    let html = if let Some(text) = heading(trimmed) {
        format!("<b>{}</b>", inline(text, Ctx::Emphasis))
    } else if is_rule(trimmed) {
        "──────────".to_string()
    } else if let Some(item) = list_item(trimmed) {
        format!("{indent}• {}", inline(&item, Ctx::Top))
    } else {
        inline(line, Ctx::Top)
    };
    Block {
        html,
        plain: line.to_string(),
    }
}

/// The opening of a fenced code block: its fence and language.
fn fence_open(line: &str) -> Option<(&'static str, &str)> {
    let fence = ["```", "~~~"].into_iter().find(|f| line.starts_with(f))?;
    Some((fence, line[3..].trim_matches(|c| c == '`' || c == '~').trim()))
}

fn is_table_row(line: &str) -> bool {
    let line = line.trim_end();
    line.len() > 1 && line.starts_with('|') && line.ends_with('|')
}

fn quoted(line: &str) -> Option<&str> {
    let rest = line.strip_prefix('>')?;
    Some(rest.strip_prefix(' ').unwrap_or(rest))
}

fn heading(line: &str) -> Option<&str> {
    let hashes = line.chars().take_while(|c| *c == '#').count();
    if !(1..=6).contains(&hashes) {
        return None;
    }
    let rest = &line[hashes..];
    if !rest.starts_with([' ', '\t']) {
        return None;
    }
    Some(rest.trim().trim_end_matches('#').trim_end())
}

fn is_rule(line: &str) -> bool {
    let compact: String = line.chars().filter(|c| !c.is_whitespace()).collect();
    compact.len() >= 3
        && ["-", "*", "_"]
            .iter()
            .any(|m| compact.chars().all(|c| c.to_string() == *m))
}

fn list_item(line: &str) -> Option<String> {
    let rest = ["- ", "* ", "+ "].iter().find_map(|m| line.strip_prefix(m))?;
    let rest = rest.trim_start();
    Some(if let Some(task) = rest.strip_prefix("[ ] ") {
        format!("☐ {task}")
    } else if let Some(task) = rest.strip_prefix("[x] ").or_else(|| rest.strip_prefix("[X] ")) {
        format!("☑ {task}")
    } else {
        rest.to_string()
    })
}

/// Code and tables, in monospace, cut into pieces that each fit a message.
fn preformatted(lines: &[&str], lang: &str, max: usize) -> Vec<Block> {
    let lang: String = lang
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '+' | '#' | '_'))
        .collect();
    pieces(lines, max)
        .into_iter()
        .map(|text| Block {
            html: if lang.is_empty() {
                format!("<pre>{}</pre>", escape(&text))
            } else {
                format!("<pre><code class=\"language-{lang}\">{}</code></pre>", escape(&text))
            },
            plain: text,
        })
        .collect()
}

fn blockquote(lines: &[&str], max: usize) -> Vec<Block> {
    pieces(lines, max)
        .into_iter()
        .map(|text| Block {
            html: format!(
                "<blockquote>{}</blockquote>",
                text.lines().map(|l| inline(l, Ctx::Quote)).collect::<Vec<_>>().join("\n")
            ),
            plain: text,
        })
        .collect()
}

/// Lines joined into runs of at most `max` characters; a longer line is cut.
fn pieces(lines: &[&str], max: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for line in lines.iter().flat_map(|l| char_chunks(l, max)) {
        let needed = current.chars().count() + line.chars().count() + 1;
        if !current.is_empty() && needed > max {
            out.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push('\n');
        }
        current.push_str(&line);
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

fn char_chunks(line: &str, max: usize) -> Vec<String> {
    let chars: Vec<char> = line.chars().collect();
    if chars.is_empty() {
        return vec![String::new()];
    }
    chars.chunks(max.max(1)).map(|c| c.iter().collect()).collect()
}

fn pack(blocks: Vec<Block>, max: usize) -> Vec<Message> {
    let mut out = Vec::new();
    let mut current: Vec<Block> = Vec::new();
    let mut len = 0;
    for block in blocks {
        let n = block.plain.chars().count().max(visible_len(&block.html)) + 1;
        if len + n > max && !current.is_empty() {
            out.extend(message(std::mem::take(&mut current)));
            len = 0;
        }
        len += n;
        current.push(block);
    }
    out.extend(message(current));
    out
}

/// The characters Telegram counts once the markup is read: tags drop out and an
/// entity is one character.
fn visible_len(html: &str) -> usize {
    let mut len = 0;
    let mut chars = html.chars();
    while let Some(ch) = chars.next() {
        match ch {
            '<' => chars.by_ref().take_while(|c| *c != '>').for_each(drop),
            '&' => {
                chars.by_ref().take_while(|c| *c != ';').for_each(drop);
                len += 1;
            }
            _ => len += 1,
        }
    }
    len
}

fn message(mut blocks: Vec<Block>) -> Option<Message> {
    while blocks.last().is_some_and(Block::is_blank) {
        blocks.pop();
    }
    let start = blocks.iter().position(|b| !b.is_blank())?;
    let blocks = &blocks[start..];
    let join = |f: fn(&Block) -> &str| blocks.iter().map(f).collect::<Vec<_>>().join("\n");
    Some(Message {
        html: join(|b| &b.html),
        plain: join(|b| &b.plain),
    })
}

// ---- inline spans --------------------------------------------------------------

/// Where a span sits, which decides what Telegram lets it contain.
#[derive(Clone, Copy, PartialEq)]
enum Ctx {
    Top,
    /// Inside bold, italic or strikethrough: no code.
    Emphasis,
    /// Inside a link: no code, no other link.
    Link,
    /// Inside a quote: no code, no link.
    Quote,
}

fn inline(text: &str, ctx: Ctx) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::new();
    render(&chars, ctx, &mut out);
    out
}

fn render(c: &[char], ctx: Ctx, out: &mut String) {
    let mut i = 0;
    while i < c.len() {
        let ch = c[i];
        if ch == '\\' && c.get(i + 1).is_some_and(char::is_ascii_punctuation) {
            push_escaped(out, c[i + 1]);
            i += 2;
        } else if ch == '`' {
            i = code_span(c, i, ctx, out);
        } else if ch == '[' {
            i = link(c, i, ctx, out);
        } else if ch == '<' {
            i = autolink(c, i, ctx, out);
        } else if matches!(ch, '*' | '_' | '~') {
            i = emphasis(c, i, ctx, out);
        } else if let Some(end) = bare_url(c, i) {
            c[i..end].iter().for_each(|ch| push_escaped(out, *ch));
            i = end;
        } else {
            push_escaped(out, ch);
            i += 1;
        }
    }
}

fn run(c: &[char], i: usize, ch: char) -> usize {
    c[i..].iter().take_while(|x| **x == ch).count()
}

fn code_span(c: &[char], i: usize, ctx: Ctx, out: &mut String) -> usize {
    let n = run(c, i, '`');
    let Some(end) = code_close(c, i + n, n) else {
        out.push_str(&"`".repeat(n));
        return i + n;
    };
    let code: String = c[i + n..end].iter().collect();
    let code = escape(code.trim());
    if ctx == Ctx::Top {
        out.push_str(&format!("<code>{code}</code>"));
    } else {
        out.push_str(&code);
    }
    end + n
}

fn code_close(c: &[char], from: usize, n: usize) -> Option<usize> {
    let mut j = from;
    while j < c.len() {
        if c[j] == '`' {
            let m = run(c, j, '`');
            if m == n {
                return Some(j);
            }
            j += m;
        } else {
            j += 1;
        }
    }
    None
}

fn link(c: &[char], i: usize, ctx: Ctx, out: &mut String) -> usize {
    let Some((label_end, url_end)) = link_parts(c, i) else {
        out.push('[');
        return i + 1;
    };
    let label = &c[i + 1..label_end];
    let target: String = c[label_end + 2..url_end].iter().collect();
    let url = target.split_whitespace().next().unwrap_or("").trim_matches(['<', '>']);
    if linkable(url) && matches!(ctx, Ctx::Top | Ctx::Emphasis) {
        out.push_str(&format!("<a href=\"{}\">", escape_attr(url)));
        render(label, Ctx::Link, out);
        out.push_str("</a>");
    } else {
        render(label, ctx, out);
        if !url.is_empty() && label.iter().collect::<String>() != url {
            out.push_str(" (");
            out.push_str(&escape(url));
            out.push(')');
        }
    }
    url_end + 1
}

/// `[label](url)` starting at `i`: where the label and the url end.
fn link_parts(c: &[char], i: usize) -> Option<(usize, usize)> {
    let mut depth = 0;
    let mut j = i + 1;
    let label_end = loop {
        match c.get(j)? {
            '\\' => j += 1,
            '[' => depth += 1,
            ']' if depth == 0 => break j,
            ']' => depth -= 1,
            _ => {}
        }
        j += 1;
    };
    if c.get(label_end + 1) != Some(&'(') {
        return None;
    }
    let mut depth = 0;
    let mut j = label_end + 2;
    loop {
        match c.get(j)? {
            '(' => depth += 1,
            ')' if depth == 0 => return Some((label_end, j)),
            ')' => depth -= 1,
            _ => {}
        }
        j += 1;
    }
}

fn linkable(url: &str) -> bool {
    ["https://", "http://", "tg://", "mailto:"]
        .iter()
        .any(|scheme| url.len() > scheme.len() && url.to_ascii_lowercase().starts_with(scheme))
}

fn autolink(c: &[char], i: usize, ctx: Ctx, out: &mut String) -> usize {
    let close = c[i..].iter().position(|ch| *ch == '>').map(|p| i + p);
    if let Some(close) = close {
        let url: String = c[i + 1..close].iter().collect();
        if linkable(&url) && !url.contains(char::is_whitespace) {
            if matches!(ctx, Ctx::Top | Ctx::Emphasis) {
                out.push_str(&format!("<a href=\"{}\">{}</a>", escape_attr(&url), escape(&url)));
            } else {
                out.push_str(&escape(&url));
            }
            return close + 1;
        }
    }
    out.push_str("&lt;");
    i + 1
}

/// A bare `http(s)://` address starting at `i`, kept whole so the `_` and `*`
/// it may contain aren't read as emphasis. Telegram links it by itself.
fn bare_url(c: &[char], i: usize) -> Option<usize> {
    if i > 0 && c[i - 1].is_alphanumeric() {
        return None;
    }
    let rest: String = c[i..c.len().min(i + 8)].iter().collect::<String>().to_ascii_lowercase();
    if !rest.starts_with("https://") && !rest.starts_with("http://") {
        return None;
    }
    let mut end = i + c[i..].iter().take_while(|ch| !ch.is_whitespace() && **ch != '<').count();
    while end > i {
        let last = c[end - 1];
        let open = c[i..end].iter().filter(|ch| **ch == '(').count();
        let close = c[i..end].iter().filter(|ch| **ch == ')').count();
        if matches!(last, '.' | ',' | ';' | ':' | '!' | '?' | '"' | '\'' | '*' | '_') || (last == ')' && close > open) {
            end -= 1;
        } else {
            break;
        }
    }
    Some(end)
}

/// `*x*`, `_x_`, `**x**`, `__x__`, `***x***` and `~~x~~`. A lone `~` stays
/// literal — it's "about" far more often than strikethrough.
fn emphasis(c: &[char], i: usize, ctx: Ctx, out: &mut String) -> usize {
    let ch = c[i];
    let n = run(c, i, ch);
    let literal = |out: &mut String| {
        (0..n).for_each(|_| push_escaped(out, ch));
        i + n
    };
    if n > 3 || (ch == '~' && n != 2) {
        return literal(out);
    }
    let opens = c.get(i + n).is_some_and(|x| !x.is_whitespace())
        && (ch != '_' || i == 0 || !c[i - 1].is_alphanumeric());
    let Some(close) = opens.then(|| emphasis_close(c, i + n, ch, n)).flatten() else {
        return literal(out);
    };
    let (open_tag, close_tag) = match (ch, n) {
        ('~', _) => ("<s>", "</s>"),
        (_, 1) => ("<i>", "</i>"),
        (_, 2) => ("<b>", "</b>"),
        _ => ("<b><i>", "</i></b>"),
    };
    let inner = if ctx == Ctx::Top { Ctx::Emphasis } else { ctx };
    out.push_str(open_tag);
    render(&c[i + n..close], inner, out);
    out.push_str(close_tag);
    close + n
}

fn emphasis_close(c: &[char], from: usize, ch: char, n: usize) -> Option<usize> {
    let mut j = from;
    while j < c.len() {
        if c[j] == '`' {
            let m = run(c, j, '`');
            j = code_close(c, j + m, m).map_or(j + m, |end| end + m);
            continue;
        }
        if c[j] != ch {
            j += 1;
            continue;
        }
        let m = run(c, j, ch);
        let after = c.get(j + m);
        if m == n
            && j > from
            && !c[j - 1].is_whitespace()
            && (ch != '_' || !after.is_some_and(|x| x.is_alphanumeric()))
        {
            return Some(j);
        }
        j += m;
    }
    None
}

fn push_escaped(out: &mut String, ch: char) {
    match ch {
        '&' => out.push_str("&amp;"),
        '<' => out.push_str("&lt;"),
        '>' => out.push_str("&gt;"),
        _ => out.push(ch),
    }
}

fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    text.chars().for_each(|ch| push_escaped(&mut out, ch));
    out
}

fn escape_attr(text: &str) -> String {
    escape(text).replace('"', "&quot;")
}

#[cfg(test)]
#[path = "telegramfmt_tests.rs"]
mod tests;
