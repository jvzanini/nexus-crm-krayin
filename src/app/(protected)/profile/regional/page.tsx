import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UserRegionalForm } from "./_components/user-regional-form";
import { auth } from "@/auth";

export default async function UserRegionalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Preferências regionais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure idioma, fuso horário e formato de data.
        </p>
      </div>
      <UserRegionalForm
        currentLocale={(session?.user as any)?.locale ?? "pt-BR"}
        currentTimezone={(session?.user as any)?.timezone ?? "America/Sao_Paulo"}
      />
    </div>
  );
}
