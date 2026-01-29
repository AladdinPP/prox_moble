import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from "@/components/ProxCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { ChevronRight, User, Store, Shield, FileText } from "lucide-react";

export function Account() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/welcome");
    } catch (e) {
      console.error("Sign out error:", e);
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: "Please try again.",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const MenuRow = ({
    icon: Icon,
    title,
    onClick,
  }: {
    icon: React.ElementType;
    title: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full p-4 bg-card border border-border/50 rounded-lg hover:bg-accent/5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <span className="font-secondary text-base text-black">{title}</span>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background">
      <div className="flex-1 p-4 space-y-6 pb-24">
        <ProxCard className="w-full max-w-xl mx-auto">
          <ProxCardHeader>
            <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">
              Settings
            </ProxCardTitle>
          </ProxCardHeader>
          <ProxCardContent className="space-y-6">
            {/* MY PREFERENCES Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                My Preferences
              </h3>
              <div className="space-y-2">
                <MenuRow
                  icon={User}
                  title="Personal Info"
                  onClick={() => navigate("/account/personal-info")}
                />
                <MenuRow
                  icon={Store}
                  title="Preferred Retailers"
                  onClick={() => navigate("/account/preferred-retailers")}
                />
              </div>
            </div>

            {/* FEEDBACK Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Feedback
              </h3>
              <div className="bg-accent/5 border border-border/50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground font-secondary text-center">
                  We'd love to hear what you think about the app!
                </p>
                <Button
                  type="button"
                  onClick={() => navigate("/feedback")}
                  className="w-full h-10 bg-prox hover:bg-prox-hover text-white font-secondary"
                >
                  Give Feedback
                </Button>
              </div>
            </div>

            {/* ACCOUNT & PRIVACY Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Account & Privacy
              </h3>
              <div className="space-y-2">
                <MenuRow
                  icon={Shield}
                  title="Privacy Policy"
                  onClick={() => navigate("/account/privacy-policy")}
                />
                <MenuRow
                  icon={FileText}
                  title="Terms of Service"
                  onClick={() => navigate("/account/terms-of-service")}
                />
              </div>
            </div>

            {/* Sign Out Button */}
            <Button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              variant="outline"
              className="w-full h-12 font-primary font-medium text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              {signingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </ProxCardContent>
        </ProxCard>
      </div>

      <BottomNav current="Account" />
    </div>
  );
}
