import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Home as HomeIcon, 
  Users, 
  Settings, 
  ArrowLeft,
  Plus,
  Building2,
  Menu
} from 'lucide-react';

// Import subcomponents
import { HouseholdOverview } from './household/household';
import { MembersManagement } from './Members/Members';

type DashboardView = 'overview' | 'members' | 'settings';

export function Households() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [showMobileNav, setShowMobileNav] = useState(false);

  const sidebarItems = [
    {
      id: 'overview' as DashboardView,
      label: 'Overview',
      icon: HomeIcon,
      description: 'Household summary and stats'
    },
    {
      id: 'members' as DashboardView,
      label: 'Members',
      icon: Users,
      description: 'Manage household members'
    }
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return <HouseholdOverview />;
      case 'members':
        return <MembersManagement />;
      case 'settings':
        return <div className="text-center py-12">
          <Settings className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Settings</h3>
          <p className="text-muted-foreground">Household settings coming soon...</p>
        </div>;
      default:
        return <HouseholdOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className={`mx-auto px-4 py-3 ${isMobile ? 'px-3' : 'max-w-6xl py-4'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/home')}
                className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}
              >
                <ArrowLeft className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </Button>
              <div className={`rounded-prox overflow-hidden ${isMobile ? 'w-8 h-8' : 'w-10 h-10'}`}>
                <img
                  src="/Icon-01.jpg"
                  alt="Prox Logo"
                  className={`object-cover object-center transform translate-x-[5%] translate-y-[-25%] ${isMobile ? 'w-16 h-16' : 'w-20 h-20'}`}
                />
              </div>
              <div>
                <h1 className={`font-semibold text-foreground font-primary ${isMobile ? 'text-lg' : 'text-xl'}`}>
                  Household Dashboard
                </h1>
                <p className={`text-muted-foreground font-secondary ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  Manage your household and members
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileNav(!showMobileNav)}
                  className="h-8 w-8"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobile && showMobileNav && (
        <div className="fixed inset-0 bg-black/50 z-20" onClick={() => setShowMobileNav(false)}>
          <div className="absolute top-16 left-0 right-0 bg-card border-b border-border/50 shadow-lg">
            <nav className="p-4 space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveView(item.id);
                      setShowMobileNav(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-3 text-left transition-all rounded-lg ${
                      isActive 
                        ? 'bg-accent/10 text-accent' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm font-secondary">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className={`mx-auto px-4 py-6 ${isMobile ? 'px-3 py-4' : 'max-w-6xl'}`}>
        {isMobile ? (
          /* Mobile Layout */
          <div className="space-y-4">
            {/* Mobile Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border/50 z-10">
              <div className="flex">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveView(item.id)}
                      className={`flex-1 flex flex-col items-center py-3 px-2 transition-all ${
                        isActive 
                          ? 'text-accent bg-accent/10' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mb-1`} />
                      <span className="text-xs font-medium font-secondary">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Content Area */}
            <div className="pb-20">
              <ProxCard>
                <ProxCardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                  {renderActiveView()}
                </ProxCardContent>
              </ProxCard>
            </div>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="flex gap-6">
            {/* Left Sidebar */}
            <div className="w-64 flex-shrink-0">
              <ProxCard className="sticky top-24">
                <ProxCardContent className="p-0">
                  <nav className="space-y-1">
                    {sidebarItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveView(item.id)}
                          className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-all hover:bg-muted/50 ${
                            isActive 
                              ? 'bg-accent/10 text-accent border-r-2 border-accent' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm font-secondary">
                              {item.label}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </nav>
                </ProxCardContent>
              </ProxCard>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              <ProxCard>
                <ProxCardContent className="p-6">
                  {renderActiveView()}
                </ProxCardContent>
              </ProxCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
