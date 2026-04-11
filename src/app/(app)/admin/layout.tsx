import { redirect } from "next/navigation";

import { getRealUser } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Always use the REAL user (ignoring impersonation) so admins
  // can access the admin panel while impersonating another user.
  const user = await getRealUser();

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
