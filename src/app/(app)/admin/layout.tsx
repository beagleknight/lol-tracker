import { redirect } from "next/navigation";

import { requireUser } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
