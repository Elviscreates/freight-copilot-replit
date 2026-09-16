import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { AppShell } from '@/App';

function renderAppShell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppShell />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe('AppShell renders overview', () => {
  it('renders the app and shows overview metrics', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-dashboard')).not.toBeInTheDocument();
    }, { timeout: 20000 });

    await waitFor(() => {
      expect(screen.getByTestId('metric-pending-count')).toBeInTheDocument();
    }, { timeout: 10000 });
  });
});