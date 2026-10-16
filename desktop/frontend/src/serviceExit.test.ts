import { describe, expect, it } from "vitest";
import { crashSummary, liveServices, projectUp, serviceCrashed, serviceExitText } from "./serviceExit";
import type { ServiceInfo } from "./types";

const svc = (name: string, extra: Partial<ServiceInfo> = {}): ServiceInfo => ({
  name,
  cmd: "",
  cwd: "",
  port: 0,
  ...extra,
});

describe("serviceExit", () => {
  it("says how a service ended", () => {
    expect(serviceExitText({ exited: true, exitCode: 1 })).toBe("exited with code 1");
    expect(serviceExitText({ exited: true, exitCode: 0 })).toBe("exited");
    expect(serviceExitText({ exited: true, exitCode: null })).toBe("stopped");
  });

  it("calls only a failed exit a crash", () => {
    expect(serviceCrashed({ exited: true, exitCode: 2 })).toBe(true);
    expect(serviceCrashed({ exited: true, exitCode: 0 })).toBe(false);
    expect(serviceCrashed({ exited: true, exitCode: null })).toBe(false);
    expect(serviceCrashed({})).toBe(false);
  });

  it("counts an ended service as not running", () => {
    const project = {
      running: true,
      services: [svc("web"), svc("crashy", { exited: true, exitCode: 1 })],
    };
    expect(liveServices(project).map((s) => s.name)).toEqual(["web"]);
    expect(projectUp(project)).toBe(true);
    expect(crashSummary(project)).toBe("crashy exited with code 1");
  });

  it("treats a project whose every service ended as down", () => {
    const project = { running: true, services: [svc("job", { exited: true, exitCode: 0 })] };
    expect(projectUp(project)).toBe(false);
    expect(liveServices(project)).toEqual([]);
    expect(crashSummary(project)).toBeNull();
    expect(projectUp({ running: false, services: [] })).toBe(false);
    expect(projectUp({ running: true, services: [] })).toBe(true);
  });
});
