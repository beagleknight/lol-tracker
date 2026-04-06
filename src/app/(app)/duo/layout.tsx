import { PremiumGate } from "@/components/premium-gate";
import { isPremium, requireUser } from "@/lib/session";

export default async function DuoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  if (!isPremium(user)) {
    return <PremiumGate />;
  }

  return <>{children}</>;
}
