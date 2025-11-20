import { StatusBar } from "@/components/StatusBar";
import { AppCard } from "@/components/AppCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index: React.FC = () => {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Build the cheapest cart",
      description:
        "Add your list and see which mix of nearby stores gives you the lowest total.",
      icon: "🛒",
      gradient: "bg-gradient-primary",
      onClick: () => navigate("/cart-finder"),
    },
    {
      title: "Scan & upload receipts",
      description:
        "Upload a photo of your receipt to track your spend and improve your future savings.",
      icon: "📸",
      gradient: "bg-gradient-secondary",
      onClick: () => navigate("/add-item"),
    },
    {
      title: "Browse weekly deals",
      description:
        "See the strongest sales across your favorite retailers in one clean view.",
      icon: "🏷️",
      gradient: "bg-gradient-primary",
      onClick: () => navigate("/deal-search"),
    },
    {
      title: "Pantry & household",
      description:
        "See what you already have at home, share with your household, and avoid waste.",
      icon: "🥫",
      gradient: "bg-gradient-secondary",
      onClick: () => navigate("/home"),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      {/* Top status bar */}
      <StatusBar />

      {/* Main content */}
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col px-5 pb-6 pt-4">
        {/* Prox chip / tagline */}
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_theme(colors.accent.DEFAULT)]" />
            Smarter grocery shopping with Prox
          </div>
        </div>

        {/* Hero card */}
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-card shadow-soft">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/18 via-emerald-500/6 to-background" />
          <div className="relative z-10 flex items-center gap-4 px-5 py-4">
            <div className="flex-1 space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                Make every grocery dollar go further.
              </h1>
              <p className="text-xs text-muted-foreground">
                Compare prices across nearby stores, build the cheapest cart, and never
                miss a weekly deal again.
              </p>
              <Button
                size="sm"
                className="mt-1 rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground shadow-glow hover:bg-accent/90"
                onClick={() => navigate("/cart-finder")}
              >
                Start a new cart
              </Button>
            </div>

            {/* Simple Prox icon block instead of image */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-background/60">
              <div className="flex h-full w-full items-center justify-center text-3xl">
                🥑
              </div>
            </div>
          </div>
        </div>

        {/* Section header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Quick actions
          </h2>
          <span className="text-[10px] text-muted-foreground">
            Built for weekly shops & top-off runs
          </span>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 gap-3">
          {cards.map((card) => (
            <AppCard
              key={card.title}
              title={card.title}
              description={card.description}
              icon={card.icon}
              gradient={card.gradient}
              className="relative overflow-hidden border border-border/60 bg-card/90 shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-medium"
              onClick={card.onClick}
            />
          ))}
        </div>

        {/* Subtle footer */}
        <div className="mt-auto flex justify-center pt-6 text-[10px] text-muted-foreground">
          <span>Built by Prox · Prices refresh weekly</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
