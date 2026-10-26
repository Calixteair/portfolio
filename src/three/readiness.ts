/** What must be compiled before the visitor may dive through the portal. */
export interface DiveReadiness {
  system: boolean;
  tunnel: boolean;
}

export function createDiveReadiness(): DiveReadiness {
  return { system: false, tunnel: false };
}

export function markReady(readiness: DiveReadiness, part: keyof DiveReadiness): void {
  readiness[part] = true;
}
