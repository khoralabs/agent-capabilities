let seq = 0;

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq}`;
}

export function newRegistrationId(): string {
  return nextId("reg");
}

export function newLinkId(): string {
  return nextId("link");
}

export function newSnapshotId(): string {
  return nextId("snap");
}

export function newTransitionId(): string {
  return nextId("trans");
}
