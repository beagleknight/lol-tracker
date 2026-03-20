"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { linkRiotAccount, unlinkRiotAccount } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LinkIcon, Unlink, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [riotId, setRiotId] = useState("");
  const [isPending, startTransition] = useTransition();

  const isLinked = !!session?.user?.riotGameName;

  function handleLink() {
    if (!riotId.includes("#")) {
      toast.error("Invalid format. Use GameName#TagLine (e.g. beagleknight#euw)");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("riotId", riotId);
      const result = await linkRiotAccount(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Linked to ${result.gameName}#${result.tagLine}`
        );
        setRiotId("");
        await updateSession();
      }
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      try {
        const result = await unlinkRiotAccount();
        if (result.success) {
          toast.success("Riot account unlinked.");
          await updateSession();
        } else {
          toast.error("Failed to unlink Riot account.");
        }
      } catch {
        toast.error("Failed to unlink Riot account.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and Riot Games integration.
        </p>
      </div>

      {/* Riot Account Card */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Riot Account
            {isLinked ? (
              <Badge variant="default" className="ml-2 bg-gold/20 text-gold border border-gold/30">
                Linked
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-2">
                Not Linked
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Link your Riot Games account to sync your ranked games automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLinked ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border border-gold/20 p-4 bg-surface-elevated">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Riot ID</p>
                  <p className="text-lg font-semibold text-gold">
                    {session.user.riotGameName}#{session.user.riotTagLine}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-4 w-4" />
                  )}
                  Unlink
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Unlinking will not delete your synced match data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="riot-id">Riot ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="riot-id"
                    placeholder="beagleknight#euw"
                    value={riotId}
                    onChange={(e) => setRiotId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLink();
                    }}
                    disabled={isPending}
                  />
                  <Button onClick={handleLink} disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="mr-2 h-4 w-4" />
                    )}
                    Link
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your Riot ID in GameName#TagLine format.
                This is used to fetch your ranked match data from the Riot API.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Key Info Card */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>API Key Info</CardTitle>
          <CardDescription>
            Information about the Riot Games API key configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            The Riot API personal development key expires every 24 hours.
            If you encounter authentication errors when syncing, you may need to
            regenerate your key at{" "}
            <a
              href="https://developer.riotgames.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-electric underline hover:text-electric-light"
            >
              developer.riotgames.com
            </a>{" "}
            and update the <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded border border-border/50 font-mono">RIOT_API_KEY</code> in your{" "}
            <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded border border-border/50 font-mono">.env.local</code> file.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
