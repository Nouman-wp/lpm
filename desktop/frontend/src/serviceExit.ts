import type { ProjectInfo, ServiceInfo } from "./types";

type ExitFields = Pick<ServiceInfo, "exited" | "exitCode">;
type ProjectServices = Pick<ProjectInfo, "running" | "services">;

/** A started service whose command ended on its own with a failure. */
export function serviceCrashed(service: ExitFields): boolean {
  return !!service.exited && service.exitCode != null && service.exitCode !== 0;
}

/** How a started service ended: "exited with code 1", "exited", "stopped". */
export function serviceExitText(service: ExitFields): string {
  if (service.exitCode == null) return "stopped";
  return service.exitCode === 0 ? "exited" : `exited with code ${service.exitCode}`;
}

/** The started services of a project that are still running. */
export function liveServices(project: ProjectServices): ServiceInfo[] {
  return project.running ? (project.services ?? []).filter((s) => !s.exited) : [];
}

/** Whether anything of the project still runs: once every service it started
 *  has ended, it is up only in that their tabs are still open. */
export function projectUp(project: ProjectServices): boolean {
  const services = project.services ?? [];
  return project.running && (services.length === 0 || services.some((s) => !s.exited));
}

/** "web exited with code 1, worker exited with code 2", or null when no
 *  started service crashed. */
export function crashSummary(project: ProjectServices): string | null {
  if (!project.running) return null;
  const crashed = (project.services ?? []).filter(serviceCrashed);
  if (crashed.length === 0) return null;
  return crashed.map((s) => `${s.name} ${serviceExitText(s)}`).join(", ");
}
