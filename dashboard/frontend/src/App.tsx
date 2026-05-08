import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Moon, Sun } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import InstanceDetail from './pages/InstanceDetail';
import { useWebSocket } from './hooks/useWebSocket';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, refetchOnWindowFocus: true, retry: 1 },
  },
});

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      setDark(true);
    }
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  return (
    <button onClick={toggle} className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function AppContent() {
  useWebSocket();
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Dashboard ThemeToggle={ThemeToggle} />} />
        <Route path="/instances/:name" element={<InstanceDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
