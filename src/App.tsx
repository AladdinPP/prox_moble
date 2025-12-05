import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { UiProvider } from '@/contexts/UiContext';
import { CartProvider } from '@/contexts/CartContext';
import { Toaster } from '@/components/ui/toaster';
import { Welcome } from '@/pages/Welcome';
import { Auth } from '@/pages/Auth';
import { AddItem } from '@/pages/AddItem';
import { ExpiringSoon } from '@/pages/ExpiringSoon';
import { DealSearch } from '@/pages/DealSearch';
import { CartFinder } from '@/pages/CartFinder';
import { CartPage } from '@/pages/CartPage';
import { Households } from '@/components/home/households/households';
import { Settings } from '@/components/home/settings/Settings';
import { useGuestStore } from '@/stores/guestStore';
import { OnboardingZipCode } from '@/pages/OnboardingZipCode';
import { OnboardingChooseStores } from '@/pages/OnboardingChooseStores';
import { OnboardingSavingsPreview } from '@/pages/OnboardingSavingsPreview';
import { PantryTracker } from '@/pages/pantry-tracker';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isGuest } = useGuestStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public / auth routes */}
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/auth" element={<Auth />} />

      {/* NEW: /home now shows the Cart Finder experience */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <CartFinder />
          </ProtectedRoute>
        }
      />

      {/* NEW: Old home screen is now "Pantry Tracker" */}
      <Route
        path="/pantry-tracker"
        element={
          <ProtectedRoute>
            <PantryTracker />
          </ProtectedRoute>
        }
      />

      {/* NEW: Root route always goes to /welcome first */}
      <Route path="/" element={<Navigate to="/welcome" replace />} />

      {/* Onboarding routes (unchanged) */}
      <Route path="/onboarding/zipcode" element={<OnboardingZipCode />} />
      <Route
        path="/onboarding/choose-stores"
        element={<OnboardingChooseStores />}
      />
      <Route
        path="/onboarding/savings-preview"
        element={<OnboardingSavingsPreview />}
      />

      {/* Other app routes (unchanged behavior) */}
      <Route
        path="/add-item"
        element={
          <ProtectedRoute>
            <AddItem />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pantry-tracker/households"
        element={
          <ProtectedRoute>
            <Households />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expiring-soon"
        element={
          <ProtectedRoute>
            <ExpiringSoon />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pantry-tracker/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="/deal-search" element={<DealSearch />} />
      <Route path="/cart-finder" element={<CartFinder />} /> {/* Eventually comment this out once routing complete*/}
      <Route path="/cart" element={<CartPage />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UiProvider>
          <CartProvider>
            <Router>
              <div className="min-h-screen bg-gradient-background">
                <AppRoutes />
                <Toaster />
              </div>
            </Router>
          </CartProvider>
        </UiProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
