import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Settings as SettingsIcon, Bell, Shield, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { Profile } from './Profile';

type SettingsPage = 'profile' | 'notifications' | 'privacy' | 'help';

interface SettingsProps {
  onBack?: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState<SettingsPage>('profile');

  const settingsPages = [
    {
      id: 'profile' as const,
      title: 'Profile',
      icon: User,
      description: 'Manage your personal information'
    }
  ];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/home');
    }
  };

  const renderActivePage = () => {
    switch (activePage) {
      case 'profile':
        return <Profile />;
      case 'notifications':
        return (
          <ProxCard>
            <ProxCardContent className="p-6">
              <p className="text-muted-foreground">Notifications settings coming soon...</p>
            </ProxCardContent>
          </ProxCard>
        );
      case 'privacy':
        return (
          <ProxCard>
            <ProxCardContent className="p-6">
              <p className="text-muted-foreground">Privacy settings coming soon...</p>
            </ProxCardContent>
          </ProxCard>
        );
      case 'help':
        return (
          <ProxCard>
            <ProxCardContent className="p-6">
              <p className="text-muted-foreground">Help & support coming soon...</p>
            </ProxCardContent>
          </ProxCard>
        );
      default:
        return <Profile />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-10 w-10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="w-10 h-10 rounded-prox overflow-hidden">
                <img
                  src="/Icon-01.jpg"
                  alt="Prox Logo"
                  className="w-20 h-20 object-cover object-center transform translate-x-[5%] translate-y-[-25%]"
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground font-primary">
                  Settings
                </h1>
                <p className="text-sm text-muted-foreground font-secondary">
                  Manage your account preferences
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <ProxCard className="sticky top-32">
              <ProxCardContent className="p-4">
                <nav className="space-y-2">
                  {settingsPages.map((page) => {
                    const Icon = page.icon;
                    const isActive = activePage === page.id;
                    
                    return (
                      <button
                        key={page.id}
                        onClick={() => setActivePage(page.id)}
                        className={`w-full flex items-center space-x-3 p-3 rounded-prox text-left transition-all ${
                          isActive
                            ? 'bg-accent text-white'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <div>
                          <p className={`font-medium font-secondary ${
                            isActive ? 'text-white' : 'text-foreground'
                          }`}>
                            {page.title}
                          </p>
                          <p className={`text-xs ${
                            isActive ? 'text-white/80' : 'text-muted-foreground'
                          }`}>
                            {page.description}
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
          <div className="lg:col-span-3">
            {renderActivePage()}
          </div>
        </div>
      </div>
    </div>
  );
}
