import type { AgentKind, AgentStep, ReplyContext, ReplyIntent } from "../seed/types";

export interface Reply {
  steps: AgentStep[];
  // A proposal the reply ends on; answering yes carries it out.
  intent?: ReplyIntent;
}

// Claude and Gemini answer in full sentences, Codex and OpenCode tersely.
const warm = (agent: AgentKind) => agent === "claude" || agent === "gemini";

// Extra work trickled into a still-running session so a project you leave open
// keeps visibly advancing instead of freezing on one spinner. It only inspects,
// and says nothing about edits: the Review tab is a seeded snapshot that never
// grows. It also stays off `focusFile`, which the opening turn of every seeded
// session has already read.
export function keepAliveSteps(ctx: ReplyContext): AgentStep[] {
  return [
    { kind: "tool", label: "Bash", arg: ctx.testCmd, result: ctx.testResult },
    {
      kind: "text",
      text: `Suite is green. Reading wider through \`${ctx.hotspotDir}\` for edge cases the tests don't reach.`,
    },
    { kind: "tool", label: "Glob", arg: ctx.sourceGlob, result: ctx.sourceMatches },
    { kind: "thinking" },
    { kind: "tool", label: "Grep", arg: "TODO|FIXME", result: "3 matches" },
  ];
}

export function settleStep(ctx: ReplyContext): AgentStep {
  return {
    kind: "text",
    text: `Done — ${ctx.testCmd} is green. The 3 TODOs in \`${ctx.hotspotDir}\` are still open whenever you want them.`,
  };
}

export const GENERIC_REPLY_CONTEXT: ReplyContext = {
  manifest: "README.md",
  manifestLines: "9 lines",
  readmeLines: "9 lines",
  sourceGlob: "**/*",
  sourceMatches: "37 matches",
  overview: "Fresh project — nothing indexed yet beyond the files on disk.",
  flows: "Point me at what you're building and I'll dig in.",
  testCmd: "make test",
  testResult: "no tests configured",
  testSummary: "No test suite wired up yet. Want me to scaffold one?",
  focusFile: "README.md",
  focusLines: "9 lines",
  focusArea: "this project",
  hotspotDir: "./",
  deployFile: "README.md",
  deployLines: "9 lines",
  deployCmd: "make deploy",
  draftFile: "src/new-feature.ts",
  wireTarget: "the entry point",
};

export function stepDelay(step: AgentStep): number {
  if (step.kind === "thinking") return 650;
  if (step.kind === "tool") return 380;
  return step.text ? 260 : 90;
}

// Keeps invented filenames in the project's own language — a Python pipeline
// must not sprout a helpers.ts.
function sibling(path: string, name: string): string {
  const slash = path.lastIndexOf("/");
  const dir = slash === -1 ? "" : path.slice(0, slash + 1);
  const dot = path.lastIndexOf(".");
  const ext = dot > slash ? path.slice(dot) : "";
  return `${dir}${name}${ext}`;
}

export const AFFIRMATIVE =
  /^(y|yes|yep|yeah|yup|sure|ok|okay|do it|go ahead|go for it|please do|apply|make the change|sounds good)\b/;

export function executeReply(intent: ReplyIntent, agent: AgentKind, ctx: ReplyContext): AgentStep[] {
  const done = (text: string): AgentStep[] => [
    { kind: "text", text },
    {
      kind: "text",
      text: warm(agent) ? "Anything else you want me to pick up?" : "Ready for the next one.",
      style: "muted",
    },
  ];

  switch (intent) {
    case "fix":
      return [
        { kind: "thinking" },
        { kind: "tool", label: "Edit", arg: ctx.focusFile, result: "+14 -3" },
        { kind: "tool", label: "Edit", arg: sibling(ctx.focusFile, "helpers"), result: "+6 -6" },
        { kind: "tool", label: "Bash", arg: ctx.testCmd, result: ctx.testResult },
        ...done(`All three TODOs in ${ctx.focusArea} are resolved and the suite is green.`),
      ];
    case "add":
      return [
        { kind: "thinking" },
        { kind: "tool", label: "Edit", arg: ctx.draftFile, result: "+61 -4" },
        { kind: "tool", label: "Edit", arg: ctx.focusFile, result: "+8 -1" },
        { kind: "tool", label: "Bash", arg: ctx.testCmd, result: ctx.testResult },
        ...done(`Wired \`${ctx.draftFile}\` into ${ctx.wireTarget} and covered it with a test.`),
      ];
    case "refactor":
      return [
        { kind: "thinking" },
        { kind: "tool", label: "Edit", arg: sibling(ctx.focusFile, "shared"), result: "+24 -58" },
        { kind: "tool", label: "Edit", arg: ctx.focusFile, result: "+11 -30" },
        { kind: "tool", label: "Bash", arg: ctx.testCmd, result: ctx.testResult },
        ...done(
          `Pulled the duplicated branches in \`${ctx.hotspotDir}\` into one helper — 53 lines lighter, behaviour unchanged.`,
        ),
      ];
    case "docs":
      return [
        { kind: "thinking" },
        { kind: "tool", label: "Write", arg: "README.md", result: "+96 -41" },
        ...done("Regenerated the API section from the current routes."),
      ];
    case "deploy":
      return [
        { kind: "thinking" },
        { kind: "tool", label: "Bash", arg: ctx.testCmd, result: ctx.testResult },
        { kind: "tool", label: "Bash", arg: ctx.deployCmd, result: "deploying…" },
        ...done("Deploy is out — watching the logs for the first minute."),
      ];
  }
}

export function buildReply(
  query: string,
  agent: AgentKind,
  ctx: ReplyContext = GENERIC_REPLY_CONTEXT,
  pending?: ReplyIntent,
): Reply {
  const q = query.trim().toLowerCase();
  if (!q) return { steps: [] };

  if (pending && AFFIRMATIVE.test(q)) return { steps: executeReply(pending, agent, ctx) };

  if (/^(hi|hello|hey|yo)\b/.test(q)) {
    return {
      steps: [
        { kind: "thinking" },
        {
          kind: "text",
          text: warm(agent) ? "Hey! What can I help you with in this project?" : "Hi. What do you want to work on?",
        },
      ],
    };
  }

  if (/what (is|does)|explain|tell me|overview|summary|describe/.test(q)) {
    return {
      steps: [
        { kind: "thinking" },
        { kind: "tool", label: "Read", arg: ctx.manifest, result: ctx.manifestLines },
        { kind: "tool", label: "Read", arg: "README.md", result: ctx.readmeLines },
        { kind: "tool", label: "Glob", arg: ctx.sourceGlob, result: ctx.sourceMatches },
        { kind: "text", text: ctx.overview },
        { kind: "text", text: "", style: "muted" },
        { kind: "text", text: ctx.flows },
      ],
    };
  }

  if (/test|spec|vitest|jest|rspec/.test(q)) {
    return {
      steps: [
        { kind: "thinking" },
        { kind: "tool", label: "Bash", arg: ctx.testCmd, result: ctx.testResult },
        { kind: "text", text: ctx.testSummary },
      ],
    };
  }

  if (/fix|bug|error|failing|broken|crash|todo/.test(q)) {
    return {
      intent: "fix",
      steps: [
        { kind: "thinking" },
        { kind: "tool", label: "Grep", arg: "TODO|FIXME", result: "3 matches" },
        { kind: "tool", label: "Read", arg: ctx.focusFile, result: ctx.focusLines },
        {
          kind: "text",
          text: warm(agent)
            ? `Found 3 TODOs in ${ctx.focusArea}. Want me to patch them or walk you through what each one is blocking?`
            : `3 TODOs in ${ctx.focusArea}. I can draft a patch or leave them as-is — which?`,
        },
      ],
    };
  }

  if (/deploy|ship|release|production/.test(q)) {
    return {
      intent: "deploy",
      steps: [
        { kind: "thinking" },
        { kind: "tool", label: "Bash", arg: "git status --porcelain", result: "clean" },
        { kind: "tool", label: "Read", arg: ctx.deployFile, result: ctx.deployLines },
        {
          kind: "text",
          text: `Tree is clean. I can run \`${ctx.deployCmd}\` when you're ready — but you'll want to run the full test suite first.`,
        },
      ],
    };
  }

  if (/refactor|clean|simplify|rewrite/.test(q)) {
    return {
      intent: "refactor",
      steps: [
        { kind: "thinking" },
        { kind: "tool", label: "Glob", arg: ctx.sourceGlob, result: ctx.sourceMatches },
        {
          kind: "text",
          text: `Scanning for duplication and long functions. A few hotspots jump out in \`${ctx.hotspotDir}\` — want me to propose a refactor plan before touching anything?`,
        },
      ],
    };
  }

  if (/add|implement|build|create|new/.test(q)) {
    return {
      intent: "add",
      steps: [
        { kind: "thinking" },
        { kind: "tool", label: "Read", arg: ctx.focusFile, result: ctx.focusLines },
        { kind: "tool", label: "Write", arg: ctx.draftFile, result: "draft" },
        {
          kind: "text",
          text: `Drafted a skeleton in \`${ctx.draftFile}\`. Want me to wire it up into ${ctx.wireTarget} next?`,
        },
      ],
    };
  }

  if (/document|docs|readme|comments/.test(q)) {
    return {
      intent: "docs",
      steps: [
        { kind: "thinking" },
        { kind: "tool", label: "Read", arg: "README.md", result: ctx.readmeLines },
        {
          kind: "text",
          text: "README covers setup but the API section is stale. I can regenerate it from the current routes if that's useful.",
        },
      ],
    };
  }

  if (/^(thanks|thank you|cool|great|nice|perfect)\b/.test(q)) {
    return { steps: [{ kind: "text", text: warm(agent) ? "Anytime." : "👍" }] };
  }

  return {
    intent: "add",
    steps: [
      { kind: "thinking" },
      { kind: "tool", label: "Read", arg: ctx.manifest, result: ctx.manifestLines },
      {
        kind: "text",
        text: warm(agent)
          ? "Got it — taking a look. Want me to just describe the plan, or go ahead and make the change?"
          : "Looking now. Draft a plan or apply changes directly?",
      },
    ],
  };
}

// Where a landed turn's closing message starts: the trailing run of text,
// paragraph breaks included, which Codex sets between rules. Infinity when the
// turn ends on anything else.
export function closingStart(steps: AgentStep[]): number {
  const spoken = (step: AgentStep) => step.kind === "text" && step.text.trim() !== "";
  let start = steps.length;
  while (start > 0 && steps[start - 1].kind === "text") start--;
  while (start < steps.length && !spoken(steps[start])) start++;
  return start < steps.length ? start : Infinity;
}
