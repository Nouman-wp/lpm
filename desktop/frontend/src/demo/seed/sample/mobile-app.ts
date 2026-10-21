import type { SeedAction, SeedProject, SeedService } from "../types";
import { claudeAction, codexAction } from "./agents";
import type { ChangeSpec } from "./changes";
import { DAY, HOUR, WATCH_T0, WATCH_T1, WEEK } from "./clock";
import { defineProject } from "./define";
import { MOBILE_APP_FILES } from "./mobile-app-files";

const SERVICES: SeedService[] = [
  {
    // No port: Metro hands a device an exp:// URL rather than serving a page,
    // so there is nothing for the browser pane to open.
    name: "metro",
    cmd: "npx expo start --ios",
    log: [
      { text: "$ npx expo start --ios", color: "green", at: 50 },
      { text: "Starting project at /Users/you/Projects/mobile-app", color: "muted", at: 400 },
      { text: "Starting Metro Bundler", color: "muted", at: 650 },
      { text: "› Metro waiting on exp://192.168.1.24:8081", color: "cyan", at: 950 },
      { text: "› Using development build", color: "muted", at: 1000 },
      { text: "", at: 1050 },
      { text: "› Press a │ open Android", color: "muted", at: 1100 },
      { text: "› Press i │ open iOS simulator", color: "muted", at: 1150 },
      { text: "› Press r │ reload app", color: "muted", at: 1200 },
      { text: "› Press ? │ show all commands", color: "muted", at: 1250 },
      { text: "", at: 1300 },
      { text: "› Opening on iPhone 17 Pro", color: "muted", at: 1900 },
      { text: "iOS Bundled 3184ms index.ts (1128 modules)", color: "green", at: 3400 },
    ],
    loop: { line: { text: " LOG  [api] GET /v1/plans 200 in 96ms", color: "muted" }, everyMs: 5200 },
  },
  {
    name: "types",
    cmd: "npx tsc --noEmit --watch",
    log: [
      { text: "$ npx tsc --noEmit --watch", color: "green", at: 50 },
      { text: `[${WATCH_T0}] Starting compilation in watch mode...`, color: "muted", at: 500 },
      { text: "", at: 550 },
      { text: `[${WATCH_T1}] Found 0 errors. Watching for file changes.`, color: "cyan", at: 1600 },
    ],
  },
];

const ACTIONS: SeedAction[] = [
  claudeAction(),
  codexAction(),
  {
    name: "test",
    label: "Tests",
    emoji: "🧪",
    cmd: "pnpm test",
    display: "",
    type: "",
    durationMs: 1500,
    output: [
      { text: "$ pnpm test", color: "green", at: 50 },
      { text: "> jest", color: "muted", at: 150 },
      { text: "", at: 250 },
      { text: " PASS  src/lib/session.test.ts", color: "green", at: 700 },
      { text: " PASS  src/screens/PlansScreen.test.tsx", color: "green", at: 1050 },
      { text: "", at: 1100 },
      { text: "Test Suites: 2 passed, 2 total", color: "default", at: 1200 },
      { text: "Tests:       6 passed, 6 total", color: "default", at: 1250 },
      { text: "Snapshots:   0 total", color: "default", at: 1300 },
      { text: "Time:        2.31 s", color: "muted", at: 1350 },
      { text: "Ran all test suites.", color: "muted", at: 1450 },
    ],
  },
  {
    name: "ios",
    label: "Run iOS",
    emoji: "📱",
    cmd: "npx expo run:ios",
    display: "",
    type: "",
    durationMs: 2600,
    output: [
      { text: "$ npx expo run:ios", color: "green", at: 50 },
      { text: "› Planning build", color: "muted", at: 350 },
      {
        text: "› Executing xcodebuild -workspace ios/mobileapp.xcworkspace -scheme mobileapp",
        color: "muted",
        at: 700,
      },
      { text: "› Build Succeeded", color: "green", at: 2000 },
      { text: "› Installing on iPhone 17 Pro", color: "muted", at: 2280 },
      { text: "› Opening on iPhone 17 Pro (com.example.mobileapp)", color: "cyan", at: 2500 },
    ],
  },
  {
    name: "update",
    label: "Publish update",
    emoji: "🚢",
    cmd: "eas update --branch preview",
    display: "footer",
    type: "",
    confirm: true,
    durationMs: 1900,
    output: [
      { text: "$ eas update --branch preview", color: "green", at: 50 },
      { text: "✔ Compressed bundle files", color: "muted", at: 500 },
      { text: "✔ Uploaded 2 app bundles", color: "muted", at: 1000 },
      { text: "✔ Published!", color: "green", at: 1500 },
      { text: "  Branch          preview", color: "muted", at: 1600 },
      { text: "  Runtime version 1.4.0", color: "muted", at: 1680 },
      { text: "  Platform        ios, android", color: "muted", at: 1760 },
      { text: "  Update group    8c1e2f4a…", color: "muted", at: 1840 },
    ],
  },
];

// Left half-finished: the trial banner needs a field the API does not return
// yet, which is the work saas-app is busy adding.
const CHANGES: ChangeSpec[] = [
  {
    path: "src/lib/api.ts",
    status: "modified",
    diff: `@@ -20,6 +20,8 @@ export type Plan = {
   id: string;
   name: string;
   priceCents: number;
+  /** Days of free trial the API grants, or null when the plan has none. */
+  trialDays: number | null;
 };

 export async function fetchPlans(): Promise<Plan[]> {
@@ -40,6 +42,7 @@ function toPlan(row: PlanRow): Plan {
     id: row.id,
     name: row.name,
     priceCents: Math.round(row.price * 100),
+    trialDays: row.trial_period_days ?? null,
   };
 }
`,
  },
  {
    path: "src/screens/PlansScreen.tsx",
    status: "modified",
    diff: `@@ -46,8 +46,13 @@ function PlanRow({ plan }: { plan: Plan }) {
     <View style={styles.card}>
       <Text style={styles.planName}>{plan.name}</Text>
       <Text style={styles.price}>{formatPrice(plan.priceCents)}</Text>
+      {plan.trialDays ? (
+        <Text style={styles.trial}>{plan.trialDays} days free</Text>
+      ) : null}
       <Pressable style={styles.cta} onPress={() => subscribe(plan.id)}>
-        <Text style={styles.ctaLabel}>Choose plan</Text>
+        <Text style={styles.ctaLabel}>
+          {plan.trialDays ? "Start free trial" : "Choose plan"}
+        </Text>
       </Pressable>
     </View>
   );
@@ -80,6 +85,11 @@ const styles = StyleSheet.create({
     fontSize: 28,
     fontWeight: "600",
   },
+  trial: {
+    marginTop: 4,
+    fontSize: 13,
+    color: "#16a34a",
+  },
   cta: {
     marginTop: 16,
     borderRadius: 12,`,
  },
];

export const MOBILE_APP: SeedProject = defineProject({
  name: "mobile-app",
  root: "~/Projects/mobile-app",
  services: SERVICES,
  actions: ACTIONS,
  profiles: [
    { name: "default", services: ["metro"] },
    { name: "full", services: ["metro", "types"] },
  ],
  git: {
    branch: "main",
    upstream: true,
    ahead: 0,
    behind: 3,
    branches: [
      { name: "main", ageMs: 5 * DAY },
      { name: "feat/push-notifications", ageMs: 6 * DAY },
      { name: "chore/sdk-upgrade", ageMs: 3 * WEEK },
      { name: "main", remote: "origin", ageMs: 6 * HOUR },
      { name: "release/ios-1.4", remote: "origin", ageMs: 2 * DAY },
    ],
  },
  changes: CHANGES,
  tree: MOBILE_APP_FILES,
  reply: {
    manifest: "package.json",
    readmeLines: "23 lines",
    manifestLines: "28 lines",
    sourceGlob: "src/**/*.tsx",
    sourceMatches: "8 matches",
    overview:
      "Expo app for iOS and Android — screens in `src/screens`, the API client in `src/lib/api.ts`, native projects in `ios/` and `android/`. It reads the same `/v1` API saas-app serves.",
    flows:
      "Main flows: sign-in, plans, usage, push notifications. Want a deeper dive on any of them?",
    testCmd: "pnpm test",
    testResult: "6 passed in 2.3s",
    testSummary: "All 6 tests green across the session store and the plans screen.",
    focusFile: "src/lib/api.ts",
    focusLines: "54 lines",
    focusArea: "the API client",
    hotspotDir: "src/screens/",
    deployFile: "eas.json",
    deployLines: "42 lines",
    deployCmd: "eas update --branch preview",
    draftFile: "src/lib/offline-queue.ts",
    wireTarget: "the API client",
  },
});
