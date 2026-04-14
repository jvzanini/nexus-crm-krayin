"use client";

import { ProfileContent, type ProfileContentProps } from "@nexusai360/profile-ui";
import { useTheme } from "@/components/providers/theme-provider";

type Props = Omit<ProfileContentProps, "onThemeChange" | "currentTheme">;

export function ProfilePageClient(props: Props) {
  const { theme, setTheme } = useTheme();
  return (
    <ProfileContent {...props} currentTheme={theme} onThemeChange={setTheme} />
  );
}
