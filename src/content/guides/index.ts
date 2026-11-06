import type { Guide } from "./types";
import { irpRenewal } from "./irp-renewal";
import { ppsNumber } from "./pps-number";
import auto from "./auto.json";

export type { Guide };

/** Evergreen guides, newest first. */
export const GUIDES: Guide[] = [...(auto as Guide[]), ppsNumber, irpRenewal].sort((a, b) => b.published.localeCompare(a.published));

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
