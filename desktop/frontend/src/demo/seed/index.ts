import { EMPTY_USAGE, emptyStats } from "./empty";
import { SAMPLE } from "./sample";
import type { Seed } from "./types";

export interface SeedChoice {
  seed: Seed;
  omit: string[];
  selected?: string;
}

// `?seed=sample` opens the sample workspace (`&omit=a,b` leaves projects out for
// a tour to add); anything else is a fresh install, which leaves out every
// project so the folder picker hands them out.
export function seedFor(params: URLSearchParams): SeedChoice {
  if (params.get("seed") === "sample") {
    const omit = (params.get("omit") ?? "").split(",").filter(Boolean);
    return { seed: SAMPLE, omit, selected: SAMPLE.projects.find((p) => !omit.includes(p.name))?.name };
  }
  return {
    seed: { ...SAMPLE, usage: EMPTY_USAGE, stats: emptyStats },
    omit: SAMPLE.projects.map((p) => p.name),
  };
}
