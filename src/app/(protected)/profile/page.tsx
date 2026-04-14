import { redirect } from "next/navigation";
import type { PlatformRole } from "@nexusai360/types";
import {
  toProfileDTO,
  canEditOwnProfile,
} from "@nexusai360/profile-ui/server-helpers";
import { getCurrentUser } from "@/lib/auth";
import { profileAdapter } from "@/lib/adapters/profile";
import { ProfilePageClient } from "./_components/profile-page-client";
import {
  updateProfileAction,
  updateAvatarAction,
  requestEmailChangeAction,
  changePasswordAction,
} from "@/lib/actions/profile";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = await profileAdapter.getProfile(user.id);
  if (!raw) redirect("/login");

  const role = user.platformRole as PlatformRole;

  return (
    <ProfilePageClient
      initialProfile={toProfileDTO(raw)}
      canEdit={canEditOwnProfile(role)}
      onUpdateProfile={updateProfileAction}
      onUpdateAvatar={updateAvatarAction}
      onRequestEmailChange={requestEmailChangeAction}
      onChangePassword={changePasswordAction}
    />
  );
}
