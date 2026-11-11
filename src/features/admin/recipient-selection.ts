import type { Member } from "./types";
export const MAX_CAMPAIGN_RECIPIENTS = 500;
export type SelectedRecipient = { id: number; nickname?: string };

/** Add only active members, preserving selection across searches/pages within the API limit. */
export function selectRecipients(
  current: SelectedRecipient[],
  members: Pick<Member, "id" | "nickname" | "status">[],
) {
  const selected = new Map(current.map((member) => [member.id, member]));
  for (const member of members) {
    if (member.status !== "ACTIVE") continue;
    if (selected.has(member.id) || selected.size < MAX_CAMPAIGN_RECIPIENTS)
      selected.set(member.id, { id: member.id, nickname: member.nickname });
  }
  return [...selected.values()];
}
