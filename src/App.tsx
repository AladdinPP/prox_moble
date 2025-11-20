import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { UiProvider } from '@/contexts/UiContext';
import { Toaster } from '@/components/ui/toaster';
import { Welcome } from '@/pages/Welcome';
import { Auth } from '@/pages/Auth';
import { Home } from '@/pages/Home';
import { AddItem } from '@/pages/AddItem';
import { ExpiringSoon } from '@/pages/ExpiringSoon';
import { DealSearch } from './pages/DealSearch';
import { CartFinder } from './pages/CartFinder';
import { Households } from '@/components/home/households/households';
import { Settings } from '@/components/home/settings/Settings';
import { useGuestStore } from '@/stores/guestStore';
import Index from '@/pages/Index';

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

  return (
    <Routes>
      {/* Public / auth routes */}
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/auth" element={<Auth />} />

      {/* Main landing screen for logged-in users or guests */}
      <Route
        path="/"
        element={
          user || isGuest ? (
            <Index />
          ) : (
            <Navigate to="/welcome" replace />
          )
        }
      />

      {/* Home dashboard */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Feature routes */}
      <Route
        path="/add-item"
        element={
          <ProtectedRoute>
            <AddItem />
          </ProtectedRoute>
        }
      />

      <Route
        path="/home/households"
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
        path="/home/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      {/* Deal search + cart finder (currently not protected, can wrap if you want) */}
      <Route
        path="/deal-search"
        element={<DealSearch />}
      />
      <Route
        path="/cart-finder"
        element={<CartFinder />}
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UiProvider>
          <Router>
            <div className="min-h-screen bg-gradient-background">
              <AppRoutes />
              <Toaster />
            </div>
          </Router>
        </UiProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
