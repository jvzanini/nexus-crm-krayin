import { redirect } from "next/navigation";
import { CompaniesContent } from "@nexusai360/companies-ui";
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyActive,
} from "@/lib/actions/company";
import { getCurrentUser } from "@/lib/auth";
import type { CurrentUser } from "@nexusai360/types";

export default async function CompaniesPage() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.platformRole !== "super_admin" && u.platformRole !== "admin") {
    redirect("/dashboard");
  }
  return (
    <CompaniesContent
      isSuperAdmin={u.isSuperAdmin}
      currentUserId={u.id}
      currentUser={u as unknown as CurrentUser}
      actions={{
        getCompanies,
        createCompany,
        updateCompany,
        deleteCompany,
        toggleCompanyActive,
      }}
    />
  );
}
