import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('Dispatch flow - reject', () => {
  it('rejects load FC-2048 and updates pending count', async () => {
    const user = userEvent.setup();

    renderAppShell();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-dashboard')).not.toBeInTheDocument();
    }, { timeout: 20000 });

    // Navigate to queue view
    const queueNavButton = screen.getByTestId('button-nav-queue');
    await user.click(queueNavButton);

    // Wait for queue to render and find FC-2048
    await waitFor(() => {
      const loadButton = screen.getByTestId('button-select-load-FC-2048');
      expect(loadButton).toBeInTheDocument();
    }, { timeout: 10000 });

    // Click on FC-2048 to select it
    const loadFC2048Button = screen.getByTestId('button-select-load-FC-2048');
    await user.click(loadFC2048Button);

    // Wait for detail view to show FC-2048
    await waitFor(() => {
      expect(screen.getByTestId('text-load-route-FC-2048')).toHaveTextContent('Atlanta, GA to Chicago, IL');
    }, { timeout: 10000 });

    // Click reject button
    const rejectButton = screen.getByTestId('button-reject-load');
    expect(rejectButton).not.toBeDisabled();
    await user.click(rejectButton);

    // Wait for toast confirmation
    await waitFor(() => {
      expect(screen.getByTestId('status-toast')).toHaveTextContent('FC-2048 rejected and moved to history');
    }, { timeout: 10000 });

    // Check pending count decreased in sidebar nav
    await waitFor(() => {
      const queueNavCount = screen.getByTestId('button-nav-queue').querySelector('.fc-nav-count');
      expect(queueNavCount).toHaveTextContent('4');
    }, { timeout: 10000 });

    // Navigate back to overview to check history
    const overviewNavButton = screen.getByTestId('button-nav-overview');
    await user.click(overviewNavButton);

    // Check history shows rejected
    await waitFor(() => {
      const historyRow = screen.getByTestId('row-overview-history-FC-2048');
      expect(historyRow).toBeInTheDocument();
      expect(historyRow).toHaveTextContent('Rejected');
    }, { timeout: 10000 });
  });
});