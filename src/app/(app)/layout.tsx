import { requireUser } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-mesh">
        <AppSidebar
          user={{
            name: user.name,
            image: user.image,
            riotGameName: user.riotGameName,
            riotTagLine: user.riotTagLine,
          }}
        />
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
