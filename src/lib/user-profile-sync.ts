type UserProfileFields = {
  displayName: string | null;
  avatarUrl: string | null;
};

type ProviderProfileFields = {
  displayName?: string | null;
  avatarUrl?: string | null;
};

// Provider syncs must never replace profile fields the user already has;
// they only fill gaps. `undefined` tells Prisma to leave the column as is.
export function getUserProfileSyncData(
  existing: UserProfileFields | null,
  profile: ProviderProfileFields,
) {
  return {
    displayName: existing?.displayName ?? profile.displayName ?? undefined,
    avatarUrl: existing?.avatarUrl ?? profile.avatarUrl ?? undefined,
  };
}
