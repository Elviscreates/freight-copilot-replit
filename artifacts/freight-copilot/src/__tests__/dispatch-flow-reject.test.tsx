import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { AppShell } from '@/App';
import { vi } from 'vitest';

vi.mock('@/lib/api', () => {
  const mockPipelines = [
    {
      id: 'FC-2048',
      origin: 'Atlanta',
      destination: 'Chicago',
      originState: 'GA',
      destinationState: 'IL',
      equipment: "53' Dry Van",
      rate: 3200,
      benchmark: 3050,
      margin: 18.6,
      confidence: 94,
      weight: '42,800 lb',
      miles: 716,
      commodity: 'Packaged foods',
      shipper: 'Pine & Rail Foods',
      pickup: 'May 21 · 08:00–10:00',
      delivery: 'May 22 · 14:00–16:00',
      received: '2 min ago',
      status: 'pending',
      carriers: [
        { name: 'Blue Ridge Logistics', score: 96, equipment: '53\' Dry Van · 4.8★', phone: '(404) 555-0192', email: 'blueridge@example.com' },
        { name: 'Northline Carriers', score: 91, equipment: '53\' Dry Van · 4.7★', phone: '(773) 555-0124', email: 'northline@example.com' },
      ],
      review_summary: {
        shipper_email: 'shipper@example.com',
        carrier_contacts: [{ email: 'blueridge@example.com', name: 'Blue Ridge Logistics' }],
      },
    },
    {
      id: 'FC-2047',
      origin: 'Dallas',
      destination: 'Phoenix',
      originState: 'TX',
      destinationState: 'AZ',
      equipment: "48' Dry Van",
      rate: 2450,
      benchmark: 2510,
      margin: 12.4,
      confidence: 88,
      weight: '38,200 lb',
      miles: 1065,
      commodity: 'Consumer electronics',
      shipper: 'Westgate Supply Co.',
      pickup: 'May 21 · 13:00–15:00',
      delivery: 'May 23 · 09:00–12:00',
      received: '7 min ago',
      status: 'pending',
      carriers: [
        { name: 'Desert Linehaul', score: 92, equipment: '48\' Dry Van · 4.7★', phone: '(602) 555-0171', email: 'desert@example.com' },
      ],
      review_summary: {
        shipper_email: 'shipper2@example.com',
        carrier_contacts: [{ email: 'desert@example.com', name: 'Desert Linehaul' }],
      },
    },
  ];

  return {
    fetchPipelines: vi.fn().mockResolvedValue({ pipelines: mockPipelines, count: mockPipelines.length }),
    fetchHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
    approvePipeline: vi.fn().mockResolvedValue({ status: 'approved', pipeline_id: 'FC-2048' }),
    rejectPipeline: vi.fn().mockResolvedValue({ status: 'rejected', pipeline_id: 'FC-2048' }),
    createSSEConnection: vi.fn((callbacks) => {
      callbacks.onStatusChange?.('connected');
      return () => callbacks.onStatusChange?.('disconnected');
    }),
  };
});

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
    }, { timeout: 10000 });

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
      expect(queueNavCount).toHaveTextContent('1');
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