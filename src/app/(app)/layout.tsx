import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";

async function SidebarWithUser() {
  await connection();
  const user = await requireUser();

  return (
    <AppSidebar
      user={{
        name: user.name,
        image: user.image,
        riotGameName: user.riotGameName,
        riotTagLine: user.riotTagLine,
      }}
    />
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-mesh">
        <Suspense>
          <SidebarWithUser />
        </Suspense>
        <main className="flex-1 md:ml-64">
          <div className="container mx-auto max-w-7xl p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </SessionProvider>
  );
}
