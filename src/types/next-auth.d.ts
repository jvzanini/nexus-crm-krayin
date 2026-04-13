import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    isSuperAdmin?: boolean;
    platformRole?: string;
    avatarUrl?: string | null;
    theme?: string;
    locale?: string | null;
    timezone?: string | null;
  }

  interface Session {
    user: User & {
      id: string;
      isSuperAdmin: boolean;
      platformRole: string;
      avatarUrl: string | null;
      theme: string;
      locale: string | null;
      timezone: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isSuperAdmin: boolean;
    platformRole: string;
    avatarUrl: string | null;
    theme: string;
    locale: string | null;
    timezone: string | null;
  }
}
