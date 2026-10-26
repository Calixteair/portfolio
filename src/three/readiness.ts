/** What must be compiled before the visitor may dive through the portal. */
export interface DiveReadiness {
  system: boolean;
  tunnel: boolean;
  /** Both also compiled for the lens pipeline's own pass (MRT), which shows them full screen. */
  lens: boolean;
}

export function createDiveReadiness(): DiveReadiness {
  return { system: false, tunnel: false, lens: false };
}

export function markReady(readiness: DiveReadiness, part: keyof DiveReadiness): void {
  readiness[part] = true;
}
