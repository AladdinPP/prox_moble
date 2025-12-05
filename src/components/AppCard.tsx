import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AppCardProps {
  title: string;
  description: string;
  icon: string;
  gradient?: string;
  className?: string;
  onClick?: () => void;
}

export const AppCard = ({ 
  title, 
  description, 
  icon, 
  gradient = "bg-gradient-primary",
  className,
  onClick 
}: AppCardProps) => {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden cursor-pointer transform transition-all duration-300 ease-ios",
        "hover:scale-105 hover:shadow-glow active:scale-95",
        "border-0 shadow-medium rounded-ios p-6",
        "bg-gradient-glass backdrop-blur-sm",
        className
      )}
      onClick={onClick}
    >
      <div className={cn("absolute inset-0 opacity-10", gradient)} />
      <div className="relative z-10 flex flex-col items-center text-center space-y-4">
        <div className="text-4xl mb-2">{icon}</div>
        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </Card>
  );
};