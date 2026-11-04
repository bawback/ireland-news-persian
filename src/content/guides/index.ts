import type { Guide } from "./types";
import { irpRenewal } from "./irp-renewal";
import { ppsNumber } from "./pps-number";

export type { Guide };

/** Evergreen guides, newest first. */
export const GUIDES: Guide[] = [ppsNumber, irpRenewal];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
