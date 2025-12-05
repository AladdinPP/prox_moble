import { StatusBar } from "@/components/StatusBar";
import { AppCard } from "@/components/AppCard";
import heroImage from "@/assets/hero-image.jpg";

const Index = () => {
  const apps = [
    {
      title: "Photos",
      description: "Capture and edit your memories with advanced filters and AI enhancement",
      icon: "📸",
      gradient: "bg-gradient-primary"
    },
    {
      title: "Messages",
      description: "Stay connected with friends and family through secure messaging",
      icon: "💬",
      gradient: "bg-gradient-secondary"
    },
    {
      title: "Music",
      description: "Stream millions of songs and discover new artists tailored for you",
      icon: "🎵",
      gradient: "bg-gradient-primary"
    },
    {
      title: "Weather",
      description: "Get accurate forecasts and real-time weather updates for any location",
      icon: "🌤️",
      gradient: "bg-gradient-secondary"
    },
    {
      title: "Calendar",
      description: "Organize your schedule and never miss important events",
      icon: "📅",
      gradient: "bg-gradient-primary"
    },
    {
      title: "Notes",
      description: "Capture ideas, create lists, and sync across all your devices",
      icon: "📝",
      gradient: "bg-gradient-secondary"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Status Bar */}
      <StatusBar />
      
      {/* Hero Section */}
      <div className="relative px-6 py-8">
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <img 
              src={heroImage} 
              alt="iPhone App Interface" 
              className="w-32 h-24 object-cover rounded-ios shadow-medium mx-auto mb-4"
            />
            <div className="absolute inset-0 bg-gradient-glass rounded-ios"></div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome to iOS
          </h1>
          <p className="text-muted-foreground">
            Experience the power of simplicity
          </p>
        </div>
      </div>

      {/* App Grid */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app, index) => (
            <AppCard
              key={index}
              title={app.title}
              description={app.description}
              icon={app.icon}
              gradient={app.gradient}
              onClick={() => {
                // Add haptic feedback simulation
                console.log(`Opening ${app.title}...`);
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Safe Area */}
      <div className="h-8 bg-gradient-to-t from-background/50 to-transparent"></div>
    </div>
  );
};

export default Index;