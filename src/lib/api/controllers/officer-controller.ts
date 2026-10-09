import { officerService } from "$api/services/officer-service";
import { type OfficerRecord, OfficerStatus } from "$lib/types";

export async function fetchOfficers(bypassCache = false): Promise<OfficerRecord[]> {
  return await officerService.fetchOfficers(bypassCache);
}

export async function addOfficer(
  data: Omit<OfficerRecord, "raw" | "id" | "status"> & {
    id?: string;
    status?: OfficerStatus | string;
  }
) {
  await officerService.addOfficer({
    ...data,
    id: data.id || crypto.randomUUID(),
    status: data.status || OfficerStatus.ACTIVE
  });
}

export async function deleteOfficer(id: string) {
  await officerService.deleteOfficer(id);
}

export async function updateOfficer(id: string, data: Partial<OfficerRecord>) {
  await officerService.updateOfficer(id, data);
}

export async function updateOfficerStatus(id: string, status: OfficerStatus) {
  await updateOfficer(id, { status });
}

export async function transitionOfficerPosition(id: string, newPosition: string) {
  const officers = await fetchOfficers();
  const current = officers.find((o) => o.id === id);
  if (!current) {
    throw new Error("Officer not found");
  }

  await updateOfficer(id, { status: OfficerStatus.CHANGED_POSITION });

  await addOfficer({
    position: newPosition,
    name: current.name,
    nickname: current.nickname,
    email: current.email,
    fbLink: current.fbLink,
    term: current.term,
    committee: current.committee,
    birthday: current.birthday,
    photoUrl: current.photoUrl || "",
    photoAutoUrl: current.photoAutoUrl || "",
    status: OfficerStatus.ACTIVE
  });
}
