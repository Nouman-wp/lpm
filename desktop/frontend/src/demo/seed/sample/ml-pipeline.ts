import type { AgentTask, SeedAction, SeedProject, SeedService, SeedSession } from "../types";
import { codexAction } from "./agents";
import type { ChangeSpec } from "./changes";
import { BOOT_T0, BOOT_T1, BOOT_T2, DASHED, DAY, HOUR, MINUTE, runId } from "./clock";
import { defineProject } from "./define";
import { ML_PIPELINE_FILES } from "./ml-pipeline-files";

// The question is about work the visitor can already see: the two files in the
// Review tab are the fix, sitting uncommitted. Asking to make the change would
// ask permission for a diff already on disk, so it asks to score it instead.
const TASK_CODEX: AgentTask = {
  prompt: "Fix the train/test leak in the feature scaler",
  steps: [
    { kind: "tool", label: "Read", arg: "pipeline/features.py", result: "32 lines" },
    { kind: "tool", label: "Bash", arg: 'rg -n "amount_norm|scaler" pipeline', result: "6 matches" },
    {
      kind: "text",
      text: "`amount_norm` was divided by `df[\"amount\"].max()` across the whole frame, so the test split set the scale training saw. It's a RobustScaler fit on the train split alone now, with the val metric logged in `pipeline/train.py` — both files are uncommitted in the working tree.",
    },
    {
      kind: "text",
      text: "Closing the leak will move your eval numbers. Refit and score it so you see the honest ones before this is committed?",
    },
  ],
};

const ANSWER: SeedSession["answer"] = {
  intent: "fix",
  steps: [
    { kind: "thinking" },
    { kind: "tool", label: "Bash", arg: "pytest -q", result: "9 passed in 4.8s" },
    {
      kind: "tool",
      label: "Bash",
      arg: "python -m pipeline.eval --refit",
      result: "accuracy 0.904",
    },
    {
      kind: "text",
      text: "0.924 → 0.904 once the scaler only ever sees the train split. That drop is the leak coming out, not a regression — the old number was scored against statistics the model had already been given. Tests are green and both files are still uncommitted, so the diff is yours to review.",
    },
    { kind: "text", text: "Ready for the next one.", style: "muted" },
  ],
};

const SERVICES: SeedService[] = [
  {
    name: "notebook",
    cmd: "jupyter lab --no-browser",
    port: 8888,
    log: [
      { text: "$ jupyter lab --no-browser", color: "green", at: 50 },
      {
        text: `[I ${DASHED} ${BOOT_T0}.000 ServerApp] jupyter_lsp | 2.2.5`,
        color: "muted",
        at: 400,
      },
      {
        text: `[I ${DASHED} ${BOOT_T0}.112 ServerApp] jupyterlab | 4.0.11`,
        color: "muted",
        at: 550,
      },
      {
        text: `[I ${DASHED} ${BOOT_T0}.214 ServerApp] Serving notebooks from: /Users/you/Projects/ml-pipeline`,
        color: "muted",
        at: 700,
      },
      {
        text: `[I ${DASHED} ${BOOT_T1}.320 ServerApp] Jupyter Server 2.12.1 is running at:`,
        color: "muted",
        at: 900,
      },
      {
        text: `[I ${DASHED} ${BOOT_T1}.321 ServerApp] http://localhost:8888/lab?token=9e2e…`,
        color: "cyan",
        at: 1000,
      },
    ],
  },
  {
    name: "trainer",
    cmd: "python -m pipeline.train",
    log: [
      { text: "$ python -m pipeline.train", color: "green", at: 50 },
      { text: "loading dataset: ./data/train.parquet (128MB)", color: "muted", at: 400 },
      { text: "epoch 1/10  loss=0.4821  acc=0.812", color: "default", at: 1200 },
      { text: "epoch 2/10  loss=0.3114  acc=0.874", color: "default", at: 2100 },
      { text: "epoch 3/10  loss=0.2247  acc=0.902", color: "default", at: 3000 },
      { text: "epoch 4/10  loss=0.1968  acc=0.911", color: "default", at: 3900 },
      { text: "epoch 5/10  loss=0.1743  acc=0.918", color: "default", at: 4800 },
      { text: "epoch 6/10  loss=0.1522  acc=0.924", color: "default", at: 5700 },
      { text: "epoch 7/10  loss=0.1361  acc=0.929", color: "default", at: 6600 },
      { text: "epoch 8/10  loss=0.1204  acc=0.933", color: "default", at: 7500 },
      { text: "epoch 9/10  loss=0.1078  acc=0.937", color: "default", at: 8400 },
      { text: "epoch 10/10 loss=0.0982  acc=0.939", color: "default", at: 9300 },
      { text: `saved ./runs/${runId(BOOT_T0)}.ckpt`, color: "green", at: 9900 },
    ],
  },
];

const ACTIONS: SeedAction[] = [
  codexAction(TASK_CODEX),
  {
    name: "train",
    label: "Train",
    emoji: "🏋️",
    cmd: "python -m pipeline.train --full",
    display: "",
    type: "",
    confirm: true,
    durationMs: 2400,
    output: [
      { text: "$ python -m pipeline.train --full", color: "green", at: 50 },
      { text: "loading dataset: ./data/train.parquet (128MB)", color: "muted", at: 300 },
      { text: "gpu: NVIDIA A100 40GB · batch=64", color: "muted", at: 600 },
      { text: "epoch 1/10  loss=0.4821  acc=0.812", color: "default", at: 1000 },
      { text: "epoch 5/10  loss=0.1872  acc=0.908", color: "default", at: 1600 },
      { text: "epoch 10/10 loss=0.0914  acc=0.942", color: "default", at: 2100 },
      { text: `saved ./runs/${runId(BOOT_T2)}.ckpt`, color: "green", at: 2300 },
    ],
  },
  {
    name: "eval",
    label: "Evaluate",
    emoji: "📊",
    cmd: "python -m pipeline.eval --latest",
    display: "",
    type: "",
    durationMs: 1800,
    output: [
      { text: "$ python -m pipeline.eval --latest", color: "green", at: 50 },
      { text: "loading checkpoint ./runs/latest.ckpt", color: "muted", at: 300 },
      { text: "scoring test set (4096 samples)", color: "muted", at: 900 },
      { text: "accuracy: 0.9241", color: "green", at: 1500 },
      { text: "f1:       0.9103", color: "green", at: 1650 },
    ],
  },
];

const CHANGES: ChangeSpec[] = [
  {
    path: "pipeline/features.py",
    status: "modified",
    diff: `@@ -27,4 +27,6 @@ def build_features(df: pd.DataFrame) -> pd.DataFrame:
     df = df.dropna(subset=["user_id"])
-    df["amount_norm"] = df["amount"] / df["amount"].max()
+    # max() leaks the test set into training — scale on the train split only
+    scaler = RobustScaler().fit(df.loc[df.split == "train", ["amount"]])
+    df["amount_norm"] = scaler.transform(df[["amount"]])
     df["is_weekend"] = df["ts"].dt.dayofweek >= 5
     return df`,
  },
  {
    path: "pipeline/train.py",
    status: "modified",
    diff: `@@ -40,4 +40,6 @@ def train(cfg: Config) -> Path:
     model = GradientBoosting(**cfg.params)
     model.fit(X_train, y_train)
+    mlflow.log_metric("val_f1", f1_score(y_val, model.predict(X_val)))
+    mlflow.log_params(cfg.params)
     ckpt = RUNS / f"{run_id}.ckpt"
     joblib.dump(model, ckpt)`,
  },
];

export const ML_PIPELINE: SeedProject = defineProject({
  name: "ml-pipeline",
  root: "~/Projects/ml-pipeline",
  services: SERVICES,
  actions: ACTIONS,
  profiles: [
    { name: "default", services: ["notebook"] },
    { name: "full", services: ["notebook", "trainer"] },
  ],
  git: {
    branch: "exp/data-pipeline-v3",
    upstream: true,
    ahead: 4,
    behind: 2,
    branches: [
      { name: "exp/data-pipeline-v3", ageMs: HOUR },
      { name: "main", ageMs: 3 * DAY },
      { name: "exp/embeddings", ageMs: 2 * DAY },
      { name: "fix/oom", ageMs: 5 * DAY },
      { name: "main", remote: "origin", ageMs: 12 * HOUR },
    ],
  },
  changes: CHANGES,
  tree: ML_PIPELINE_FILES,
  reply: {
    manifest: "pyproject.toml",
    readmeLines: "25 lines",
    manifestLines: "24 lines",
    sourceGlob: "pipeline/**/*.py",
    sourceMatches: "15 matches",
    overview:
      "Python training pipeline in `pipeline/`, exploratory notebooks in `notebooks/`, checkpoints under `runs/`.",
    flows: "Main stages: ingest, features, train, eval. Want a deeper dive on any of them?",
    testCmd: "pytest -q",
    testResult: "9 passed in 4.8s",
    testSummary: "All 9 tests green across features, training, and eval.",
    focusFile: "pipeline/features.py",
    focusLines: "32 lines",
    focusArea: "the feature builder",
    hotspotDir: "pipeline/",
    deployFile: "Makefile",
    deployLines: "13 lines",
    deployCmd: "make train-full",
    draftFile: "pipeline/transforms.py",
    wireTarget: "the pipeline config",
  },
  session: {
    kind: "codex",
    task: TASK_CODEX,
    state: "waiting",
    ageMs: 4 * MINUTE,
    answer: ANSWER,
  },
});
