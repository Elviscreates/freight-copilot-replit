import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// Mock fetch for API calls
const mockPipelinesResponse = {
  pipelines: [
    {
      id: 'TEST-001',
      pipeline_id: 'TEST-001',
      origin: 'Chicago, IL',
      destination: 'Atlanta, GA',
      originState: 'IL',
      destinationState: 'GA',
      equipment: 'Dry Van',
      rate: 2500,
      benchmark: 2300,
      margin: 8.7,
      confidence: 94,
      weight: '40000',
      miles: 715,
      commodity: 'General Freight',
      shipper: 'Acme Shipping',
      pickup: '2024-01-15',
      delivery: '2024-01-16',
      received: '2024-01-14',
      status: 'pending',
      carriers: [
        { name: 'Carrier One', score: 95, equipment: 'Dry Van', phone: '555-0101', email: 'carrier1@example.com' },
        { name: 'Carrier Two', score: 88, equipment: 'Dry Van', phone: '555-0102', email: 'carrier2@example.com' }
      ],
      review_summary: {
        shipper_email: 'shipper@acme.com',
        carrier_contacts: [{ email: 'carrier1@example.com', name: 'Carrier One' }]
      },
      drafts: {
        shipper_email: { body: 'Test shipper email' },
        carrier_outreach: { body: 'Test carrier outreach' }
      }
    }
  ],
  count: 1
};

const originalFetch = global.fetch;
global.fetch = vi.fn().mockImplementation((url: string | URL | Request, options?: RequestInit) => {
  const urlString = url.toString();
  
  if (urlString.includes('/api/pipelines') && !urlString.includes('/approve') && !urlString.includes('/reject')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockPipelinesResponse),
      status: 200,
      statusText: 'OK',
    });
  }
  
  if (urlString.includes('/health')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
      status: 200,
      statusText: 'OK',
    });
  }
  
  if (urlString.includes('/approve')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'approved', pipeline_id: 'TEST-001' }),
      status: 200,
      statusText: 'OK',
    });
  }
  
  if (urlString.includes('/reject')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'rejected', pipeline_id: 'TEST-001' }),
      status: 200,
      statusText: 'OK',
    });
  }
  
  return originalFetch(url, options);
});

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.onopen?.(new Event('open'));
      
      // Simulate a new_load event after connection
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'new_load',
              pipeline_id: 'TEST-002',
              summary: {
                load_id: 'TEST-002',
                origin: 'Dallas, TX',
                destination: 'Phoenix, AZ',
                originState: 'TX',
                destinationState: 'AZ',
                equipment: 'Reefer',
                rate: 3200,
                benchmark: 3000,
                margin: 6.7,
                confidence: 91,
                weight: '35000',
                miles: 885,
                commodity: 'Produce',
                shipper: 'Fresh Foods Inc',
                pickup: '2024-01-16',
                delivery: '2024-01-18',
                received: '2024-01-15',
                status: 'pending',
                carriers: [],
                review_summary: { shipper_email: 'shipper@fresh.com' }
              }
            })
          }));
        }
      }, 10);
    }, 0);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
  dispatchEvent(_event: Event) { return true; }
}

Object.defineProperty(window, 'EventSource', {
  writable: true,
  value: MockEventSource,
});