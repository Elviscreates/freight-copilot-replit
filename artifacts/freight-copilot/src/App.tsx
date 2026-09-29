import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  History as HistoryIcon,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const brandMarkSrc = `${import.meta.env.BASE_URL}branding/freight-copilot-mark.png`;
const brandLogoSrc = `${import.meta.env.BASE_URL}branding/freight-copilot-logo.png`;

type Section = 'overview' | 'queue' | 'benchmarks' | 'history' | 'settings';
type LoadStatus = 'pending' | 'approved' | 'rejected';
type DraftChannel = 'shipper' | 'carrier';

type Load = {
  id: string;
  origin: string;
  destination: string;
  originState: string;
  destinationState: string;
  equipment: string;
  rate: number;
  benchmark: number;
  margin: number;
  confidence: number;
  weight: string;
  miles: number;
  commodity: string;
  shipper: string;
  pickup: string;
  delivery: string;
  received: string;
  status: LoadStatus;
  carriers: { name: string; score: number; equipment: string; phone: string }[];
};

type HistoryItem = {
  id: string;
  route: string;
  status: 'approved' | 'rejected';
  timestamp: string;
  rate: number;
};

const mockLoads: Load[] = [
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
      { name: 'Blue Ridge Logistics', score: 96, equipment: '53\' Dry Van · 4.8★', phone: '(404) 555-0192' },
      { name: 'Northline Carriers', score: 91, equipment: '53\' Dry Van · 4.7★', phone: '(773) 555-0124' },
      { name: 'Copper State Freight', score: 87, equipment: 'Reefer / Dry Van · 4.6★', phone: '(312) 555-0168' },
    ],
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
      { name: 'Desert Linehaul', score: 92, equipment: '48\' Dry Van · 4.7★', phone: '(602) 555-0171' },
      { name: 'Red River Transit', score: 85, equipment: '53\' Dry Van · 4.6★', phone: '(214) 555-0110' },
      { name: 'Mesa Freightworks', score: 81, equipment: 'Dry Van · 4.5★', phone: '(480) 555-0135' },
    ],
  },
  {
    id: 'FC-2046',
    origin: 'Columbus',
    destination: 'Nashville',
    originState: 'OH',
    destinationState: 'TN',
    equipment: "53' Reefer",
    rate: 1980,
    benchmark: 1905,
    margin: 16.2,
    confidence: 91,
    weight: '39,500 lb',
    miles: 423,
    commodity: 'Fresh produce',
    shipper: 'Harvest Table Markets',
    pickup: 'May 21 · 06:00–08:00',
    delivery: 'May 21 · 18:00–20:00',
    received: '14 min ago',
    status: 'pending',
    carriers: [
      { name: 'Midwest Cold Chain', score: 94, equipment: '53\' Reefer · 4.9★', phone: '(614) 555-0183' },
      { name: 'Volunteer Express', score: 89, equipment: '53\' Reefer · 4.8★', phone: '(615) 555-0107' },
      { name: 'Freshway Transport', score: 84, equipment: 'Reefer · 4.6★', phone: '(317) 555-0129' },
    ],
  },
  {
    id: 'FC-2045',
    origin: 'Savannah',
    destination: 'Charlotte',
    originState: 'GA',
    destinationState: 'NC',
    equipment: "53' Dry Van",
    rate: 1260,
    benchmark: 1340,
    margin: 8.7,
    confidence: 73,
    weight: '44,100 lb',
    miles: 259,
    commodity: 'Building materials',
    shipper: 'Meridian Home Goods',
    pickup: 'May 21 · 10:00–12:00',
    delivery: 'May 21 · 17:00–19:00',
    received: '21 min ago',
    status: 'pending',
    carriers: [
      { name: 'Pioneer Haulage', score: 84, equipment: '53\' Dry Van · 4.6★', phone: '(912) 555-0109' },
      { name: 'Queen City Freight', score: 79, equipment: '53\' Dry Van · 4.5★', phone: '(704) 555-0148' },
      { name: 'Carolina Direct', score: 74, equipment: 'Dry Van · 4.5★', phone: '(803) 555-0156' },
    ],
  },
  {
    id: 'FC-2044',
    origin: 'Memphis',
    destination: 'St. Louis',
    originState: 'TN',
    destinationState: 'MO',
    equipment: "53' Dry Van",
    rate: 980,
    benchmark: 1020,
    margin: 10.1,
    confidence: 82,
    weight: '41,600 lb',
    miles: 283,
    commodity: 'Paper products',
    shipper: 'Atlas Industrial',
    pickup: 'May 21 · 15:00–17:00',
    delivery: 'May 22 · 08:00–10:00',
    received: '28 min ago',
    status: 'pending',
    carriers: [
      { name: 'Gateway Freight', score: 88, equipment: '53\' Dry Van · 4.7★', phone: '(314) 555-0103' },
      { name: 'Delta Roadways', score: 83, equipment: 'Dry Van · 4.5★', phone: '(901) 555-0133' },
      { name: 'Heartland Haul', score: 76, equipment: 'Dry Van · 4.4★', phone: '(636) 555-0119' },
    ],
  },
];

const starterDrafts: Record<string, Record<DraftChannel, string>> = Object.fromEntries(
  mockLoads.map((load) => [
    load.id,
    {
      shipper: `Hi ${load.shipper} team,\n\nFreight Copilot has matched a carrier for your ${load.origin}, ${load.originState} → ${load.destination}, ${load.destinationState} shipment. The quoted linehaul is $${load.rate.toLocaleString()} and pickup is scheduled for ${load.pickup}.\n\nPlease confirm the appointment window and let us know if anything has changed.\n\nBest,\nDispatch Operations`,
      carrier: `Hi carrier team — we have a ${load.equipment} load available from ${load.origin}, ${load.originState} to ${load.destination}, ${load.destinationState}. Pickup: ${load.pickup}. Linehaul: $${load.rate.toLocaleString()}. Reply YES to confirm capacity and we will send the rate confirmation.`,
    },
  ]),
);

const initialHistory: HistoryItem[] = [
  { id: 'FC-2039', route: 'Jacksonville, FL → Raleigh, NC', status: 'approved', timestamp: 'Today, 09:42', rate: 1425 },
  { id: 'FC-2038', route: 'Louisville, KY → Atlanta, GA', status: 'approved', timestamp: 'Today, 08:17', rate: 1750 },
  { id: 'FC-2034', route: 'Houston, TX → Denver, CO', status: 'rejected', timestamp: 'Yesterday, 16:29', rate: 2890 },
];

const navItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'queue', label: 'Load Queue', icon: ClipboardCheck },
  { id: 'benchmarks', label: 'DAT Benchmarks', icon: BarChart3 },
  { id: 'history', label: 'Dispatch History', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function money(value: number) {
  return `$${value.toLocaleString()}`;
}

function statusLabel(status: LoadStatus) {
  if (status === 'approved') return 'Dispatched';
  if (status === 'rejected') return 'Rejected';
  return 'Pending review';
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      setNotice('Enter your email and password to continue.');
      return;
    }
    setNotice('');
    setLocation('/dashboard');
  }

  return (
    <div className="fc-login">
      <section className="fc-login-panel" aria-label="Sign in to Freight Copilot">
        <div className="fc-login-form-wrap">
          <div className="fc-login-brand">
            <div className="fc-login-brand-mark"><img src={brandMarkSrc} alt="" /></div>
            <div className="fc-login-brand-wordmark"><span>FREIGHT</span><strong>COPILOT</strong></div>
          </div>

          <div className="fc-login-heading">
            <h1>Welcome <span>back</span></h1>
            <p>Sign in to access your logistics dashboard,<br />track shipments and manage your operations.</p>
          </div>

          <form className="fc-login-form" onSubmit={handleSubmit}>
            <label className="fc-login-field">
              <span>Email</span>
              <div className="fc-login-input-wrap">
                <Mail size={14} />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  aria-label="Email"
                />
              </div>
            </label>
            <label className="fc-login-field">
              <span>Password</span>
              <div className="fc-login-input-wrap">
                <LockKeyhole size={14} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  aria-label="Password"
                />
                <button
                  type="button"
                  className="fc-login-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            <button className="fc-login-submit" type="submit">
              Sign In <ArrowRight size={14} />
            </button>
            {notice && <div className="fc-login-notice" role="status">{notice}</div>}
          </form>

          <div className="fc-login-divider"><span>Or continue with</span></div>
          <div className="fc-login-providers">
            <button type="button" onClick={() => setNotice('Google sign-in is ready to connect.')}>
              <span className="fc-provider-google">G</span> Google
            </button>
            <button type="button" onClick={() => setNotice('Microsoft sign-in is ready to connect.')}>
              <span className="fc-provider-microsoft"><i /><i /><i /><i /></span> Microsoft
            </button>
            <button type="button" onClick={() => setNotice('SSO sign-in is ready to connect.')}>
              <ShieldCheck size={14} /> SSO
            </button>
          </div>
          <p className="fc-login-admin">Don't have an account? <button type="button" onClick={() => setNotice('Contact your workspace administrator for access.')}>Contact your admin</button></p>
        </div>
      </section>

      <section className="fc-login-visual" aria-label="Freight Copilot">
        <div className="fc-login-slash fc-login-slash-top" />
        <div className="fc-login-slash fc-login-slash-bottom" />
        <div className="fc-login-hero-lockup">
          <img src={brandLogoSrc} alt="Freight Copilot" />
          <p>SMARTER LOGISTICS. FASTER DELIVERIES.</p>
        </div>
      </section>
    </div>
  );
}

function AppShell() {
  const [section, setSection] = useState<Section>('overview');
  const [loads, setLoads] = useState<Load[]>(mockLoads);
  const [selectedId, setSelectedId] = useState(mockLoads[0].id);
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LoadStatus>('all');
  const [drafts, setDrafts] = useState(starterDrafts);
  const [draftTab, setDraftTab] = useState<DraftChannel>('shipper');
  const [autoSave, setAutoSave] = useState(true);
  const [draftDirty, setDraftDirty] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [syncOn, setSyncOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const selectedLoad = loads.find((load) => load.id === selectedId) ?? loads[0];
  const draftText = selectedLoad ? drafts[selectedLoad.id]?.[draftTab] ?? '' : '';
  const pendingCount = loads.filter((load) => load.status === 'pending').length;

  const filteredLoads = useMemo(
    () =>
      loads.filter((load) => {
        const haystack = `${load.id} ${load.origin} ${load.destination} ${load.shipper}`.toLowerCase();
        return haystack.includes(query.toLowerCase()) && (statusFilter === 'all' || load.status === statusFilter);
      }),
    [loads, query, statusFilter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 520);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!autoSave || !draftDirty || !selectedLoad) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      setSaveState('saved');
      setDraftDirty(false);
      showToast('Draft saved locally');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [autoSave, draftDirty, draftText, selectedLoad]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function updateDraft(value: string) {
    if (!selectedLoad) return;
    setDrafts((current) => ({
      ...current,
      [selectedLoad.id]: { ...current[selectedLoad.id], [draftTab]: value },
    }));
    setDraftDirty(true);
    setSaveState('saving');
  }

  function saveDraft() {
    if (!draftDirty) {
      showToast('Draft is already up to date');
      return;
    }
    setSaveState('saved');
    setDraftDirty(false);
    showToast(`${draftTab === 'shipper' ? 'Shipper email' : 'Carrier SMS'} saved`);
  }

  function contactCarrier(name: string, channel: string) {
    showToast(`${channel} draft opened for ${name}`);
  }

  function moveLoad(status: 'approved' | 'rejected') {
    if (!selectedLoad || selectedLoad.status !== 'pending') return;
    const nextLoad = loads.find((load) => load.status === 'pending' && load.id !== selectedLoad.id);
    setLoads((current) => current.map((load) => (load.id === selectedLoad.id ? { ...load, status } : load)));
    setHistory((current) => [
      {
        id: selectedLoad.id,
        route: `${selectedLoad.origin}, ${selectedLoad.originState} → ${selectedLoad.destination}, ${selectedLoad.destinationState}`,
        status,
        timestamp: 'Just now',
        rate: selectedLoad.rate,
      },
      ...current,
    ]);
    setSelectedId(nextLoad?.id ?? selectedLoad.id);
    showToast(status === 'approved' ? `${selectedLoad.id} approved and moved to dispatch` : `${selectedLoad.id} rejected and moved to history`);
  }

  function refreshDashboard() {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      showToast('Queue refreshed · all signals current');
    }, 550);
  }

  function renderStatus(status: LoadStatus) {
    return (
      <span className={`fc-status ${status}`} data-testid={`status-load-${status}`}>
        <i className="fc-status-dot" />
        {statusLabel(status)}
      </span>
    );
  }

  function renderQueue() {
    return (
      <section className="fc-queue" aria-label="Load queue">
        <div className="fc-queue-head">
          <div className="fc-section-title">
            <span>Inbound load queue</span>
            <small>{filteredLoads.length.toString().padStart(2, '0')} loads</small>
          </div>
          <div className="fc-queue-tools">
            <label className="fc-search">
              <Search size={13} />
              <input
                data-testid="input-load-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search loads..."
                aria-label="Search loads"
              />
            </label>
            <select
              className="fc-select"
              data-testid="select-load-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | LoadStatus)}
              aria-label="Filter load status"
            >
              <option value="all">All</option>
              <option value="pending">Review</option>
              <option value="approved">Dispatched</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="fc-load-list">
          {filteredLoads.length ? (
            filteredLoads.map((load) => (
              <button
                className={`fc-load-card ${selectedId === load.id ? 'selected' : ''}`}
                key={load.id}
                data-testid={`button-select-load-${load.id}`}
                onClick={() => setSelectedId(load.id)}
              >
                <div className="fc-load-top">
                  <span className="fc-load-id">{load.id}</span>
                  {renderStatus(load.status)}
                </div>
                <div className="fc-route">
                  <span>{load.origin}</span>
                  <ArrowRight className="fc-route-arrow" size={13} />
                  <span>{load.destination}</span>
                </div>
                <div className="fc-load-meta">
                  <span>{load.equipment} · {load.miles} mi</span>
                  <span className="fc-load-rate">{money(load.rate)}</span>
                </div>
                <div className="fc-load-meta">
                  <span>{load.shipper}</span>
                  <span className="fc-load-time">{load.received}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="fc-empty" data-testid="empty-load-queue">
              <PackageCheck size={22} />
              <div>No loads match this view.</div>
              <button className="fc-button ghost" onClick={() => { setQuery(''); setStatusFilter('all'); }}>Clear filters</button>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderDetail() {
    if (!selectedLoad) {
      return (
        <section className="fc-detail fc-empty" data-testid="empty-load-detail">
          <Archive size={27} />
          <div>Select a load to open its workspace.</div>
        </section>
      );
    }
    const benchmarkPercent = Math.min(100, Math.max(35, (selectedLoad.rate / (selectedLoad.benchmark * 1.3)) * 100));
    return (
      <section className="fc-detail" aria-label="Load detail workspace">
        <div className="fc-detail-top">
          <div>
            <div className="fc-detail-kicker">
              <span>{selectedLoad.id}</span>
              <ChevronRight size={11} />
              <span>AI review workspace</span>
            </div>
            <h2 className="fc-detail-title" data-testid={`text-load-route-${selectedLoad.id}`}>
              {selectedLoad.origin}, {selectedLoad.originState} <span>to</span> {selectedLoad.destination}, {selectedLoad.destinationState}
            </h2>
          </div>
          <div className="fc-detail-actions">
            <button className="fc-icon-button" data-testid="button-more-load-actions" aria-label="More load actions" onClick={() => showToast('More load actions coming into the local workflow')}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        <div className="fc-pipeline" aria-label="Processing pipeline">
          {['Ingestion', 'AI parsing', 'DAT rate match', 'Human approval'].map((step, index) => (
            <div className={`fc-step ${index < 3 ? 'complete' : 'active'}`} key={step}>
              <span className="fc-step-number">{index < 3 ? <Check size={10} /> : '4'}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <div className="fc-detail-grid">
          <div className="fc-panel">
            <div className="fc-panel-head">
              <span className="fc-panel-title">Load summary</span>
              <span className="fc-panel-caption">PARSED 99.1%</span>
            </div>
            <div className="fc-summary-grid">
              {[
                ['Shipper', selectedLoad.shipper, true],
                ['Equipment', selectedLoad.equipment, true],
                ['Commodity', selectedLoad.commodity, true],
                ['Pickup', selectedLoad.pickup, true],
                ['Delivery', selectedLoad.delivery, true],
                ['Weight', selectedLoad.weight, false],
                ['Distance', `${selectedLoad.miles} mi`, false],
                ['Load ID', selectedLoad.id, false],
                ['Received', selectedLoad.received, false],
              ].map(([label, value, normal]) => (
                <div className="fc-summary-cell" key={label as string} data-testid={`summary-${String(label).toLowerCase().replace(' ', '-')}`}>
                  <div className="fc-summary-label">{label}</div>
                  <div className={`fc-summary-value ${normal ? 'normal' : ''}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="fc-panel">
            <div className="fc-panel-head">
              <span className="fc-panel-title">Pricing intelligence</span>
              <span className="fc-panel-caption">DAT · LANE MATCH</span>
            </div>
            <div className="fc-price-body">
              <div className="fc-price-line"><span>Quoted linehaul</span><strong>{money(selectedLoad.rate)}</strong></div>
              <div className="fc-price-track">
                <div className="fc-price-fill" style={{ width: `${benchmarkPercent}%` }} />
                <div className="fc-price-marker" style={{ left: `${Math.min(93, (selectedLoad.benchmark / (selectedLoad.benchmark * 1.3)) * 100)}%` }}>
                  <span>DAT {money(selectedLoad.benchmark)}</span>
                </div>
              </div>
              <div className="fc-price-line"><span>Lane median · Atlanta → Chicago</span><strong>{money(selectedLoad.benchmark)}</strong></div>
              <div className="fc-price-footer">
                <div>
                  <div className="fc-margin-label">Estimated margin</div>
                  <div className="fc-margin-value">{selectedLoad.margin.toFixed(1)}%</div>
                </div>
                <div className="fc-confidence">
                  <div className="fc-confidence-label">AI match confidence</div>
                  <div className="fc-confidence-value"><ShieldCheck size={13} /> {selectedLoad.confidence}% match</div>
                </div>
              </div>
            </div>
          </div>

          <div className="fc-panel">
            <div className="fc-panel-head">
              <span className="fc-panel-title">Matched carriers</span>
              <span className="fc-panel-caption">TOP 3 · BY FIT</span>
            </div>
            <div className="fc-carrier-list">
              {selectedLoad.carriers.map((carrier) => (
                <div className="fc-carrier-row" key={carrier.name}>
                  <div>
                    <div className="fc-carrier-name">{carrier.name}</div>
                    <div className="fc-carrier-eq">{carrier.equipment}</div>
                  </div>
                  <div className="fc-score">
                    <div className="fc-score-track"><div className="fc-score-fill" style={{ width: `${carrier.score}%` }} /></div>
                    <div className="fc-score-label">{carrier.score}% fit</div>
                  </div>
                  <button className="fc-contact" data-testid={`button-contact-${carrier.name.replace(/\s/g, '-').toLowerCase()}`} onClick={() => contactCarrier(carrier.name, 'Carrier SMS')}>
                    <MessageSquare size={11} /> Contact
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="fc-panel fc-drafts">
            <div className="fc-panel-head">
              <span className="fc-panel-title">Communication drafts</span>
              <span className="fc-panel-caption">GENERATED BY COPILOT</span>
            </div>
            <div className="fc-tab-row">
              <button className={`fc-tab ${draftTab === 'shipper' ? 'active' : ''}`} data-testid="button-draft-shipper" onClick={() => setDraftTab('shipper')}>
                <Mail size={11} /> Shipper email
              </button>
              <button className={`fc-tab ${draftTab === 'carrier' ? 'active' : ''}`} data-testid="button-draft-carrier" onClick={() => setDraftTab('carrier')}>
                <MessageSquare size={11} /> Carrier SMS
              </button>
            </div>
            <div className="fc-draft-content">
              <div className="fc-draft-toolbar">
                <label className="fc-autosave">
                  <button className={`fc-switch ${autoSave ? 'on' : ''}`} data-testid="button-toggle-autosave" onClick={() => setAutoSave((current) => !current)} aria-label="Toggle auto-save">
                    <span />
                  </button>
                  Auto-save draft
                </label>
                <span className={`fc-save-state ${saveState}`} data-testid="status-draft-save">
                  {saveState === 'saving' ? <RefreshCw size={10} /> : <Check size={10} />}
                  {saveState === 'saving' ? 'Saving…' : 'Saved locally'}
                </span>
              </div>
              <textarea className="fc-textarea" data-testid="textarea-draft" value={draftText} onChange={(event) => updateDraft(event.target.value)} aria-label={`${draftTab} draft`} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="fc-button" data-testid="button-save-draft" onClick={saveDraft}><Check size={12} /> Save draft</button>
              </div>
            </div>
          </div>
        </div>

        <div className="fc-action-bar">
          <div className="fc-action-note">
            {selectedLoad.status === 'pending' ? <Zap size={13} /> : <CheckCircle2 size={13} />}
            {selectedLoad.status === 'pending' ? 'Review the extracted details before dispatch.' : `This load is ${statusLabel(selectedLoad.status).toLowerCase()}.`}
          </div>
          <div className="fc-action-buttons">
            <button className="fc-button danger" data-testid="button-reject-load" disabled={selectedLoad.status !== 'pending'} onClick={() => moveLoad('rejected')}><X size={13} /> Reject load</button>
            <button className="fc-button primary" data-testid="button-approve-load" disabled={selectedLoad.status !== 'pending'} onClick={() => moveLoad('approved')}><CheckCircle2 size={13} /> Approve &amp; dispatch</button>
          </div>
        </div>
      </section>
    );
  }

  function renderOverview() {
    const pendingLoads = loads.filter((load) => load.status === 'pending');
    const dispatchedCount = loads.filter((load) => load.status === 'approved').length;
    const averageConfidence = Math.round(loads.reduce((total, load) => total + load.confidence, 0) / loads.length);

    return (
      <>
        <div className="fc-metric-ribbon">
          <div className="fc-metric">
            <div><div className="fc-metric-label">Loads today</div><div className="fc-metric-note">Inbound freight · as of now</div></div>
            <div className="fc-metric-value">14</div>
            <div className="fc-metric-accent"><i style={{ height: '30%' }} /><i style={{ height: '47%' }} /><i style={{ height: '64%' }} /><i style={{ height: '81%' }} /><i style={{ height: '100%' }} /></div>
          </div>
          <div className="fc-metric">
            <div><div className="fc-metric-label">Pending approval</div><div className="fc-metric-note">Needs dispatch decision</div></div>
            <div className="fc-metric-value" data-testid="metric-pending-count">{pendingCount}</div>
            <div className="fc-metric-accent"><i style={{ height: '85%' }} /><i style={{ height: '65%' }} /><i style={{ height: '80%' }} /><i style={{ height: '50%' }} /><i style={{ height: '35%' }} /></div>
          </div>
          <div className="fc-metric">
            <div><div className="fc-metric-label">Automated time saved</div><div className="fc-metric-note">Compared with manual review</div></div>
            <div className="fc-metric-value green">4.2h</div>
            <div className="fc-metric-accent"><i style={{ height: '22%' }} /><i style={{ height: '41%' }} /><i style={{ height: '52%' }} /><i style={{ height: '72%' }} /><i style={{ height: '92%' }} /></div>
          </div>
        </div>
        <div className="fc-overview-grid">
          <section className="fc-table-panel">
            <div className="fc-panel-head">
              <span className="fc-panel-title">Needs a decision</span>
              <button className="fc-button ghost" data-testid="button-overview-open-queue" onClick={() => setSection('queue')}>Open full queue <ArrowRight size={13} /></button>
            </div>
            <div className="fc-overview-list">
              {pendingLoads.slice(0, 4).map((load) => (
                <button
                  className="fc-overview-load"
                  key={load.id}
                  data-testid={`button-overview-load-${load.id}`}
                  onClick={() => { setSelectedId(load.id); setSection('queue'); }}
                >
                  <span className="fc-overview-load-main">
                    <span className="fc-load-id">{load.id}</span>
                    <strong>{load.origin}, {load.originState} <ArrowRight size={11} /> {load.destination}, {load.destinationState}</strong>
                    <small>{load.shipper} · {load.received}</small>
                  </span>
                  <span className="fc-overview-load-side">
                    <span className="fc-load-rate">{money(load.rate)}</span>
                    {renderStatus(load.status)}
                  </span>
                </button>
              ))}
              {!pendingLoads.length && <div className="fc-history-empty"><CheckCircle2 size={22} /><div>All inbound loads have a decision.</div></div>}
            </div>
          </section>

          <section className="fc-table-panel">
            <div className="fc-panel-head">
              <span className="fc-panel-title">Desk pulse</span>
              <span className="fc-panel-caption">LIVE SIGNALS</span>
            </div>
            <div className="fc-pulse-grid">
              <div className="fc-pulse-item"><span>Pending review</span><strong>{pendingCount}</strong><small>loads waiting</small></div>
              <div className="fc-pulse-item"><span>Dispatched today</span><strong>{dispatchedCount + history.filter((item) => item.status === 'approved').length}</strong><small>approved loads</small></div>
              <div className="fc-pulse-item"><span>AI confidence</span><strong>{averageConfidence}%</strong><small>across active loads</small></div>
              <div className="fc-pulse-item"><span>Decision speed</span><strong>06m</strong><small>average review time</small></div>
            </div>
            <div className="fc-pulse-note"><Zap size={13} /> Market feed is current · next sync in 48 sec</div>
          </section>
        </div>

        <section className="fc-table-panel fc-overview-history">
          <div className="fc-panel-head">
            <span className="fc-panel-title">Recent dispatch decisions</span>
            <button className="fc-button ghost" data-testid="button-overview-open-history" onClick={() => setSection('history')}>View history <ArrowRight size={13} /></button>
          </div>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead><tr><th>Load</th><th>Lane</th><th>Decision</th><th>Linehaul</th><th>Timestamp</th></tr></thead>
              <tbody>
                {history.slice(0, 3).map((item) => (
                  <tr key={`${item.id}-${item.timestamp}`} data-testid={`row-overview-history-${item.id}`}>
                    <td className="mono">{item.id}</td><td><strong>{item.route}</strong></td><td>{renderStatus(item.status)}</td><td className="mono">{money(item.rate)}</td><td>{item.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderBenchmarks() {
    return (
      <div className="fc-subpage-grid">
        <div className="fc-table-panel">
          <div className="fc-panel-head"><span className="fc-panel-title">DAT lane benchmark monitor</span><span className="fc-panel-caption">UPDATED 2 MIN AGO</span></div>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead><tr><th>Lane</th><th>Equipment</th><th>Market median</th><th>Active quote</th><th>Variance</th></tr></thead>
              <tbody>
                {loads.map((load) => {
                  const variance = ((load.rate - load.benchmark) / load.benchmark) * 100;
                  return <tr key={load.id} data-testid={`row-benchmark-${load.id}`}><td><strong>{load.origin}, {load.originState} <ArrowRight size={11} style={{ verticalAlign: 'middle', margin: '0 4px' }} /> {load.destination}, {load.destinationState}</strong></td><td>{load.equipment}</td><td className="mono">{money(load.benchmark)}</td><td className="mono">{money(load.rate)}</td><td className={variance >= 0 ? 'mono' : 'mono'} style={{ color: variance >= 0 ? '#86d2a3' : '#e0a96d' }}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="fc-table-panel">
          <div className="fc-panel-head"><span className="fc-panel-title">Market signal</span><span className="fc-panel-caption">CURRENT NETWORK</span></div>
          {[
            ['Southeast → Midwest', 'High demand · reefer tightness', 78],
            ['Texas → Southwest', 'Balanced · rates softening', 54],
            ['Mid-Atlantic → Southeast', 'Capacity available', 39],
          ].map(([name, detail, value]) => (
            <div className="fc-benchmark-card" key={name as string}>
              <div className="fc-benchmark-name">{name}</div>
              <div className="fc-benchmark-meta">{detail}</div>
              <div className="fc-benchmark-values"><strong>{value}/100</strong><span>signal strength</span></div>
              <div className="fc-benchmark-bar"><i style={{ width: `${value}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderHistory() {
    return (
      <div className="fc-table-panel">
        <div className="fc-panel-head"><span className="fc-panel-title">Dispatch history</span><span className="fc-panel-caption">{history.length} RECENT DECISIONS</span></div>
        {history.length ? (
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead><tr><th>Load</th><th>Lane</th><th>Decision</th><th>Linehaul</th><th>Timestamp</th><th /></tr></thead>
              <tbody>
                {history.map((item) => (
                  <tr key={`${item.id}-${item.timestamp}`} data-testid={`row-history-${item.id}`}>
                    <td className="mono">{item.id}</td><td><strong>{item.route}</strong></td><td>{renderStatus(item.status)}</td><td className="mono">{money(item.rate)}</td><td>{item.timestamp}</td><td><button className="fc-icon-button" data-testid={`button-history-reopen-${item.id}`} onClick={() => { const found = loads.find((load) => load.id === item.id); if (found) { setSelectedId(found.id); setSection('queue'); showToast(`${item.id} reopened in queue`); } else showToast('Archived load details are read-only'); }}><ChevronRight size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="fc-history-empty"><HistoryIcon size={24} /><div>No dispatch decisions yet.</div></div>}
      </div>
    );
  }

  function renderSettings() {
    const settingRows: { title: string; description: string; enabled: boolean; toggle: () => void }[] = [
      { title: 'Live queue sync', description: 'Keep inbound load status and market signals current.', enabled: syncOn, toggle: () => setSyncOn((current) => !current) },
      { title: 'Auto-save communication drafts', description: 'Save edits as you type without interrupting review.', enabled: autoSave, toggle: () => setAutoSave((current) => !current) },
    ];
    return (
      <div className="fc-settings">
        <div className="fc-table-panel">
          <div className="fc-panel-head"><span className="fc-panel-title">Workspace settings</span><span className="fc-panel-caption">LOCAL PROFILE</span></div>
          {settingRows.map(({ title, description, enabled, toggle }) => (
            <div className="fc-setting-row" key={title}>
              <div><div className="fc-setting-title">{title}</div><div className="fc-setting-description">{description}</div></div>
              <button className={`fc-toggle ${enabled ? 'on' : ''}`} data-testid={`button-setting-${title.split(' ')[0].toLowerCase()}`} onClick={toggle} aria-label={`Toggle ${title}`}><i /></button>
            </div>
          ))}
          <div className="fc-setting-row"><div><div className="fc-setting-title">Operations profile</div><div className="fc-setting-description">Southeast regional desk · USD · miles</div></div><span className="fc-status approved"><i className="fc-status-dot" /> Active</span></div>
        </div>
      </div>
    );
  }

  const pageTitle: Record<Section, [string, string]> = {
    overview: ['Operations overview', 'Review what needs a decision, then move freight with confidence.'],
    queue: ['Load queue', 'Inbound freight parsed and staged for your approval.'],
    benchmarks: ['DAT benchmarks', 'Compare every quote against live lane intelligence.'],
    history: ['Dispatch history', 'A clear record of the calls your desk made.'],
    settings: ['Settings', 'Tune the workspace to match your dispatch rhythm.'],
  };

  return (
    <div className="fc-shell">
      <header className="fc-topbar">
        <div className="fc-top-context">
          <span className="fc-context-kicker">Freight operations</span>
          <strong>{pageTitle[section][0]}</strong>
        </div>
        <label className="fc-top-search">
          <Search size={14} />
           <input data-testid="input-global-search" placeholder="Search loads, lanes, shippers..." value={query} onChange={(event) => { setQuery(event.target.value); setSection('queue'); }} />
          <span className="fc-kbd">⌘ K</span>
        </label>
        <div className="fc-top-actions">
          <div className="fc-live"><span className="fc-live-dot" /> Live · SSE connected</div>
          <button className="fc-icon-button" data-testid="button-notifications" aria-label="Notifications" onClick={() => showToast('No new operations alerts')}><Bell size={15} /></button>
          <div className="fc-top-avatar" data-testid="avatar-operator">JD</div>
          <button className="fc-icon-button" data-testid="button-menu" aria-label="Open menu" onClick={() => showToast('Operator menu is ready') }><Menu size={17} /></button>
        </div>
      </header>

      <div className="fc-body">
        <aside className="fc-sidebar">
          <div className="fc-rail-brand">
            <div className="fc-rail-mark"><img src={brandMarkSrc} alt="" /></div>
            <div className="fc-rail-copy"><strong>Freight Copilot</strong><small>Operations console</small></div>
          </div>
          <div className="fc-nav-section">
            <div className="fc-nav-label">Workspace</div>
            {navItems.slice(0, 3).map((item) => {
              const Icon = item.icon;
               return <button className={`fc-nav-item ${section === item.id ? 'active' : ''}`} key={item.id} title={item.label} data-testid={`button-nav-${item.id}`} onClick={() => setSection(item.id)}><Icon size={15} /><span>{item.label}</span>{item.id === 'queue' && <span className="fc-nav-count">{pendingCount}</span>}</button>;
            })}
          </div>
          <div className="fc-nav-section">
            <div className="fc-nav-label">Records</div>
            {navItems.slice(3).map((item) => {
              const Icon = item.icon;
               return <button className={`fc-nav-item ${section === item.id ? 'active' : ''}`} key={item.id} title={item.label} data-testid={`button-nav-${item.id}`} onClick={() => setSection(item.id)}><Icon size={15} /><span>{item.label}</span></button>;
            })}
          </div>
          <div className="fc-side-footer">
            <strong>Dispatch desk online</strong>
            DAT feed · synced 2 min ago
          </div>
        </aside>

        <main className="fc-main">
          <div className="fc-main-inner">
            <div className="fc-page-head">
              <div>
                <div className="fc-eyebrow">Freight operations / {section}</div>
                <h1 className="fc-page-title">{pageTitle[section][0]}</h1>
                <p className="fc-page-subtitle">{pageTitle[section][1]}</p>
              </div>
              <div className="fc-head-actions">
                <button className="fc-button" data-testid="button-refresh-dashboard" onClick={refreshDashboard}><RefreshCw size={13} /> Refresh queue</button>
                <button className="fc-button" data-testid="button-filter-dashboard" onClick={() => showToast('Advanced filters are available from the queue view')}><SlidersHorizontal size={13} /> Filters</button>
              </div>
            </div>
            {loading ? (
              <div className="fc-loading" data-testid="loading-dashboard">
                <div className="fc-loading-left fc-skeleton"><div className="fc-loading-line medium" /><div className="fc-loading-line long" /><div className="fc-loading-line short" /><br /><div className="fc-loading-line long" /><div className="fc-loading-line medium" /><div className="fc-loading-line long" /><br /><div className="fc-loading-line medium" /><div className="fc-loading-line long" /></div>
                <div className="fc-detail fc-skeleton"><div className="fc-loading-line short" /><div className="fc-loading-line medium" /><br /><div className="fc-loading-line long" /><div className="fc-loading-line long" /><div className="fc-loading-line medium" /></div>
              </div>
            ) : section === 'overview' ? renderOverview() : section === 'queue' ? <div className="fc-workspace">{renderQueue()}{renderDetail()}</div> : section === 'benchmarks' ? renderBenchmarks() : section === 'history' ? renderHistory() : renderSettings()}
          </div>
        </main>
      </div>
      {toast && <div className="fc-toast" role="status" data-testid="status-toast"><CheckCircle2 size={14} /> {toast}</div>}
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/dashboard" component={AppShell} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;