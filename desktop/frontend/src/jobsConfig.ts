import YAML from "yaml";
import { ClearJobStateGlobal, PeerInvoke } from "../bridge/commands";
import { peerSlugOf } from "./peer/markers";
import {
  editGlobalDoc,
  editProjectDoc,
  globalLayer,
  projectLayer,
  repoLayer,
  type ConfigLayer,
} from "./yamlQueue";
import type { JobSourceLayer } from "./jobsFormat";

// Jobs are always project-scoped (see jobs.rs: the registry file wins over the
// repo .lpm.yml and there is no global layer), so every write here targets the
// project registry doc via the same queued read/modify/write seam actions use.

type Doc = ReturnType<typeof YAML.parseDocument>;

const JOBS_SECTION = "jobs";

// ---- pure doc helpers (unit tested) ----------------------------------------

export function readJobPayloadFromDoc(
  doc: Doc,
  id: string,
): Record<string, unknown> | null {
  const jobs = doc.get(JOBS_SECTION, true);
  if (!YAML.isMap(jobs) || !jobs.has(id)) return null;
  const entry = jobs.get(id, true);
  if (!YAML.isMap(entry)) return null;
  return (entry as YAML.YAMLMap).toJSON() as Record<string, unknown>;
}

export function setJobInDoc(
  doc: Doc,
  id: string,
  payload: Record<string, unknown>,
): void {
  let jobs = doc.get(JOBS_SECTION, true);
  if (!YAML.isMap(jobs)) {
    jobs = doc.createNode({});
    doc.set(JOBS_SECTION, jobs);
  }
  (jobs as YAML.YAMLMap).set(id, payload);
}

export function deleteJobFromDoc(doc: Doc, id: string): boolean {
  const jobs = doc.get(JOBS_SECTION, true);
  if (!YAML.isMap(jobs) || !jobs.has(id)) return false;
  (jobs as YAML.YAMLMap).delete(id);
  if ((jobs as YAML.YAMLMap).items.length === 0) doc.delete(JOBS_SECTION);
  return true;
}

export function jobIdsInDoc(doc: Doc): string[] {
  const jobs = doc.get(JOBS_SECTION, true);
  if (!YAML.isMap(jobs)) return [];
  return (jobs as YAML.YAMLMap).items
    .map((item) => {
      const key = item.key;
      return YAML.isScalar(key) ? String(key.value) : String(key);
    })
    .filter(Boolean);
}

// ---- bridge-backed operations ----------------------------------------------

// The registry doc's existing job ids, so a new job's id can avoid colliding
// with one already declared there.
export async function readJobIds(projectName: string): Promise<string[]> {
  const content = await projectLayer(projectName).read();
  return jobIdsInDoc(YAML.parseDocument(content || "{}"));
}

function layerFor(projectName: string, source: JobSourceLayer): ConfigLayer {
  if (source === "global") return globalLayer;
  if (source === "repo") return repoLayer(projectName);
  return projectLayer(projectName);
}

// ---- a paired machine's shared layer ----------------------------------------
//
// `host` is a paired machine's slug; absent = this Mac. Its global config is
// read through it, and written only through the job-scoped commands it takes
// for that (hostjobs.rs): the file as a whole is not this Mac's to replace.

const HOST_SAVE_CMD = "host_global_job_save";
const HOST_DELETE_CMD = "host_global_job_delete";

async function readGlobal(host?: string): Promise<string> {
  if (!host) return globalLayer.read();
  return ((await PeerInvoke(host, "read_global_config", {})) as string) ?? "";
}

export async function readJobPayloadFrom(
  projectName: string,
  source: JobSourceLayer,
  id: string,
): Promise<Record<string, unknown> | null> {
  // A shared job of a paired machine's is read from that machine's own layer.
  const content =
    source === "global"
      ? await readGlobal(peerSlugOf(projectName) ?? undefined)
      : await layerFor(projectName, source).read();
  return readJobPayloadFromDoc(YAML.parseDocument(content || "{}"), id);
}

export async function readGlobalJobIds(host?: string): Promise<string[]> {
  return jobIdsInDoc(YAML.parseDocument((await readGlobal(host)) || "{}"));
}

export async function saveJobGlobal(
  id: string,
  payload: Record<string, unknown>,
  host?: string,
): Promise<void> {
  if (host) {
    await PeerInvoke(host, HOST_SAVE_CMD, { id, yaml: YAML.stringify(payload) });
    return;
  }
  await editGlobalDoc((doc) => setJobInDoc(doc, id, payload));
}

export async function deleteJobGlobal(id: string, host?: string): Promise<void> {
  if (host) {
    await PeerInvoke(host, HOST_DELETE_CMD, { id });
    return;
  }
  await editGlobalDoc((doc) => {
    deleteJobFromDoc(doc, id);
  });
}

export async function clearJobStateGlobal(
  id: string,
  deleteCopies: boolean,
  host?: string,
): Promise<void> {
  if (host) {
    await PeerInvoke(host, "clear_job_state_global", { jobId: id, deleteCopies });
    return;
  }
  await ClearJobStateGlobal(id, deleteCopies);
}

export async function saveJob(
  projectName: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await editProjectDoc(projectName, (doc) => setJobInDoc(doc, id, payload));
}

export async function deleteJob(projectName: string, id: string): Promise<void> {
  await editProjectDoc(projectName, (doc) => {
    deleteJobFromDoc(doc, id);
  });
}
