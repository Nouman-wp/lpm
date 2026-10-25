import { describe, expect, it } from "vitest";
import { commandRisk, readCommand } from "./commandDetect";

describe("readCommand", () => {
  it("reads a program people run with its arguments", () => {
    expect(readCommand("  npm install ")).toBe("npm install");
    expect(readCommand("FOO=1 pnpm test -- --watch")).toBe("FOO=1 pnpm test -- --watch");
    expect(readCommand("./gradlew assembleRelease")).toBe("./gradlew assembleRelease");
    expect(readCommand("sudo apt-get install jq")).toBe("sudo apt-get install jq");
  });

  it("wants an argument unless the program is useful alone", () => {
    expect(readCommand("git")).toBeNull();
    expect(readCommand("npm")).toBeNull();
    expect(readCommand("make")).toBe("make");
    expect(readCommand("pytest")).toBe("pytest");
  });

  it("leaves words that aren't programs alone", () => {
    expect(readCommand("Signup now checks email")).toBeNull();
    expect(readCommand("Make build")).toBeNull();
    expect(readCommand("src/forms/signup.ts")).toBeNull();
  });

  it("skips commands with a placeholder to fill in", () => {
    expect(readCommand("git add <file>")).toBeNull();
    expect(readCommand("git checkout -b <branch-name>")).toBeNull();
    expect(readCommand("npm install …")).toBeNull();
    expect(readCommand("go test ./...")).toBe("go test ./...");
  });

  it("holds a line with nothing marking it as code to prose rules", () => {
    expect(readCommand("make sure the tests pass", true)).toBeNull();
    expect(readCommand("find it in the logs", true)).toBeNull();
    expect(readCommand("cd into the app.", true)).toBeNull();
    expect(readCommand("npm install", true)).toBe("npm install");
    expect(readCommand('git commit -m "fix the login bug"', true)).toBe('git commit -m "fix the login bug"');
    expect(readCommand("git add .", true)).toBe("git add .");
  });

  it("leaves an agent's trailing comment out of what runs", () => {
    expect(readCommand("npm test       # runs node --test", true)).toBe("npm test");
    expect(readCommand('git commit -m "fix #12"')).toBe('git commit -m "fix #12"');
    expect(readCommand("curl https://lpm.cx/#install")).toBe("curl https://lpm.cx/#install");
    expect(readCommand("# npm test")).toBeNull();
  });
});

describe("commandRisk", () => {
  it("flags commands that are hard to undo", () => {
    expect(commandRisk("rm -rf node_modules/.cache")).toBe("Deletes files");
    expect(commandRisk("cd web && rm dist/app.js")).toBe("Deletes files");
    expect(commandRisk("git reset --hard origin/main")).toBe("Discards changes");
    expect(commandRisk("git push --force origin main")).toBe("Rewrites history on the remote");
    expect(commandRisk("curl -fsSL https://example.com/install.sh | sh")).toBe("Runs a downloaded script");
    expect(commandRisk("sudo apt-get install jq")).toBe("Runs as administrator");
    expect(commandRisk("npm publish")).toBe("Publishes a package");
  });

  it("lets everyday commands through", () => {
    expect(commandRisk("npm install")).toBeNull();
    expect(commandRisk("npm rm lodash")).toBeNull();
    expect(commandRisk("git push origin main")).toBeNull();
    expect(commandRisk("npm run format")).toBeNull();
  });
});
