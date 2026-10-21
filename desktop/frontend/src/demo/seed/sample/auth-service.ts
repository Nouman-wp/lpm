import type { SeedAction, SeedProject, SeedService } from "../types";
import { claudeAction } from "./agents";
import { AUTH_SERVICE_FILES } from "./auth-service-files";
import type { ChangeSpec } from "./changes";
import { BOOT_T0, BOOT_T1, DAY, HOUR, MINUTE, REDIS_DAY, SLASHED } from "./clock";
import { defineProject } from "./define";

const SERVICES: SeedService[] = [
  {
    name: "server",
    cmd: "go run ./cmd/server",
    port: 8080,
    log: [
      { text: "$ go run ./cmd/server", color: "green", at: 50 },
      { text: `${SLASHED} ${BOOT_T0} loading config from env`, color: "muted", at: 400 },
      {
        text: `${SLASHED} ${BOOT_T0} connected to postgres://localhost:5432/api`,
        color: "muted",
        at: 650,
      },
      { text: `${SLASHED} ${BOOT_T1} migrations: up to date (14)`, color: "muted", at: 700 },
      { text: `${SLASHED} ${BOOT_T1} server listening on :8080`, color: "cyan", at: 850 },
    ],
    loop: {
      line: { text: 'GET /healthz 200 0.4ms "kube-probe/1.29"', color: "muted" },
      everyMs: 2500,
    },
  },
  {
    name: "postgres",
    cmd: "docker compose up postgres",
    port: 5432,
    log: [
      { text: "$ docker compose up postgres", color: "green", at: 50 },
      { text: "[+] Running 1/1", color: "muted", at: 400 },
      { text: " ✔ Container auth-service-postgres-1  Created", color: "muted", at: 550 },
      { text: "postgres  | PostgreSQL 16.1 starting up...", color: "muted", at: 900 },
      {
        text: "postgres  | database system is ready to accept connections",
        color: "cyan",
        at: 1500,
      },
    ],
  },
  {
    name: "redis",
    cmd: "redis-server",
    port: 6379,
    log: [
      { text: "$ redis-server", color: "green", at: 50 },
      {
        text: `37123:C ${REDIS_DAY} ${BOOT_T1}.001 * oO0OoO0OoO0Oo Redis is starting`,
        color: "muted",
        at: 400,
      },
      {
        text: `37123:M ${REDIS_DAY} ${BOOT_T1}.012 * Ready to accept connections tcp`,
        color: "cyan",
        at: 700,
      },
    ],
  },
];

const ACTIONS: SeedAction[] = [
  claudeAction(),
  {
    name: "test",
    label: "go test",
    emoji: "🧪",
    cmd: "go test ./...",
    display: "",
    type: "",
    durationMs: 1100,
    output: [
      { text: "$ go test ./...", color: "green", at: 50 },
      { text: "ok   github.com/you/auth-service/internal/auth   0.142s", color: "green", at: 500 },
      { text: "ok   github.com/you/auth-service/internal/db     0.281s", color: "green", at: 800 },
      { text: "ok   github.com/you/auth-service/internal/api    0.104s", color: "green", at: 1050 },
    ],
  },
  {
    name: "build",
    label: "Build",
    emoji: "🔨",
    cmd: "go build -o bin/server ./cmd/server",
    display: "",
    type: "",
    durationMs: 700,
    output: [
      { text: "$ go build -o bin/server ./cmd/server", color: "green", at: 50 },
      { text: "compiled: bin/server (18.2 MB)", color: "muted", at: 680 },
    ],
  },
];

const CHANGES: ChangeSpec[] = [
  {
    path: "internal/auth/rotation.go",
    status: "modified",
    diff: `@@ -17,7 +17,14 @@ func (m *Manager) Rotate(ctx context.Context, now time.Time) error {
 \tnext, err := newSigningKey()
 \tif err != nil {
 \t\treturn fmt.Errorf("rotate signing key: %w", err)
 \t}
-\tm.keys = []signingKey{next}
+\t// Give the outgoing key a deadline instead of dropping it, so tokens it
+\t// already signed keep verifying until they expire on their own.
+\tfor i := range m.keys {
+\t\tif m.keys[i].RetireAfter.IsZero() {
+\t\t\tm.keys[i].RetireAfter = now.Add(m.graceWindow)
+\t\t}
+\t}
+\tm.keys = append([]signingKey{next}, m.unexpired(now)...)
 \tm.activeKID = next.KID
 \treturn m.store.Put(ctx, m.keys)
@@ -35,0 +42,10 @@
+// unexpired keeps the keys still inside their grace window.
+func (m *Manager) unexpired(now time.Time) []signingKey {
+\tkept := make([]signingKey, 0, len(m.keys))
+\tfor _, k := range m.keys {
+\t\tif now.Before(k.RetireAfter) {
+\t\t\tkept = append(kept, k)
+\t\t}
+\t}
+\treturn kept
+}`,
  },
  {
    path: "internal/auth/jwt.go",
    status: "modified",
    diff: `@@ -102,6 +102,11 @@ func Parse(raw string, keys *KeySet) (*Claims, error) {
 \ttok, err := jwt.ParseWithClaims(raw, &Claims{}, func(t *jwt.Token) (any, error) {
-\t\treturn keys.Active().Public(), nil
+\t\tkid, _ := t.Header["kid"].(string)
+\t\tkey, ok := keys.ByID(kid)
+\t\tif !ok {
+\t\t\treturn nil, ErrUnknownKeyID
+\t\t}
+\t\treturn key.Public(), nil
 \t})
 \tif err != nil {
 \t\treturn nil, ErrInvalidToken
 \t}`,
  },
];

export const AUTH_SERVICE: SeedProject = defineProject({
  name: "auth-service",
  root: "~/Projects/auth-service",
  services: SERVICES,
  actions: ACTIONS,
  profiles: [
    { name: "default", services: ["server", "postgres", "redis"] },
    { name: "deps", services: ["postgres", "redis"] },
  ],
  git: {
    branch: "main",
    upstream: true,
    ahead: 0,
    behind: 1,
    branches: [
      { name: "main", ageMs: HOUR },
      { name: "refactor/jwt-rotation", ageMs: 4 * HOUR },
      { name: "fix/token-leak", ageMs: 2 * DAY },
      { name: "main", remote: "origin", ageMs: 20 * MINUTE },
      { name: "staging", remote: "origin", ageMs: DAY },
    ],
  },
  changes: CHANGES,
  tree: AUTH_SERVICE_FILES,
  reply: {
    manifest: "go.mod",
    readmeLines: "24 lines",
    manifestLines: "19 lines",
    sourceGlob: "**/*.go",
    sourceMatches: "21 matches",
    overview:
      "Go HTTP service in `cmd/server`, JWT auth in `internal/auth`, Postgres access in `internal/db`, Redis for sessions.",
    flows:
      "Main flows: login, token refresh, key rotation, session revocation. Want a deeper dive on any of them?",
    testCmd: "go test ./...",
    testResult: "ok — 3 packages",
    testSummary: "All green across internal/auth, internal/db, and internal/api.",
    focusFile: "internal/auth/jwt.go",
    focusLines: "122 lines",
    focusArea: "internal/auth",
    hotspotDir: "internal/",
    deployFile: "k8s/auth-service.yaml",
    deployLines: "51 lines",
    deployCmd: "kubectl rollout restart deploy/auth-service",
    draftFile: "internal/auth/handler.go",
    wireTarget: "the router",
  },
});
