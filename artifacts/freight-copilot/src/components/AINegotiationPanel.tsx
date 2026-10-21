import { useState, useCallback, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Brain,
  DollarSign,
  Target,
  ArrowLeftRight,
  Gauge,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePipelines } from '@/hooks/usePipelines';
import type { CarrierBidRequest, NegotiationResponse } from '@/lib/api';

type EquipmentType = 'Dry Van' | 'Reefer' | 'Flatbed';

const DECISION_COLORS = {
  ACCEPT: { bg: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2, label: 'Accept Bid' },
  COUNTER: { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: ArrowLeftRight, label: 'Counter Offer' },
  REJECT: { bg: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Reject Bid' },
};

const DECISION_DESCRIPTIONS = {
  ACCEPT: 'Bid is at or below market median — favorable terms',
  COUNTER: 'Bid exceeds market — negotiate to fair rate',
  REJECT: 'Bid significantly above market — re-source lane',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

interface AINegotiationPanelProps {
  selectedLoad?: {
    id: string;
    origin: string;
    destination: string;
    originState: string;
    destinationState: string;
    equipment: string;
    rate: number;
    miles: number;
    weight: string;
    commodity: string;
  } | null;
}

export function AINegotiationPanel({ selectedLoad }: AINegotiationPanelProps) {
  const { negotiate } = usePipelines();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NegotiationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [formData, setFormData] = useState<CarrierBidRequest>({
    carrier_name: '',
    bid_rate: 0,
    equipment_type: 'Dry Van',
    lane_origin: '',
    lane_destination: '',
    miles: 0,
    weight: 42000,
    commodity: 'General Freight',
    carrier_score: undefined,
    fuel_surcharge: undefined,
  });

  // Auto-populate form when selectedLoad changes
  useEffect(() => {
    if (selectedLoad) {
      const equipment = selectedLoad.equipment?.toLowerCase() || '';
      let equipmentType: EquipmentType = 'Dry Van';
      if (equipment.includes('reefer') || equipment.includes('refrigerated')) equipmentType = 'Reefer';
      else if (equipment.includes('flatbed') || equipment.includes('flat')) equipmentType = 'Flatbed';

      const origin = `${selectedLoad.origin}, ${selectedLoad.originState}`;
      const destination = `${selectedLoad.destination}, ${selectedLoad.destinationState}`;

      setFormData({
        carrier_name: '',
        bid_rate: selectedLoad.rate || 0,
        equipment_type: equipmentType,
        lane_origin: origin,
        lane_destination: destination,
        miles: selectedLoad.miles || 0,
        weight: parseInt(selectedLoad.weight?.replace(/[^0-9]/g, '') || '42000'),
        commodity: selectedLoad.commodity || 'General Freight',
        carrier_score: undefined,
        fuel_surcharge: undefined,
      });
      setResult(null);
      setError(null);
    }
  }, [selectedLoad?.id]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await negotiate(formData);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI recommendation');
    } finally {
      setIsLoading(false);
    }
  }, [negotiate, formData]);

  const handleInputChange = (field: keyof CarrierBidRequest, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getEquipmentFromLoad = (load: any): EquipmentType => {
    const eq = load.equipment?.toLowerCase() || '';
    if (eq.includes('reefer') || eq.includes('refrigerated')) return 'Reefer';
    if (eq.includes('flatbed') || eq.includes('flat')) return 'Flatbed';
    return 'Dry Van';
  };

  const decision = result?.decision;
  const decisionConfig = decision ? DECISION_COLORS[decision] : null;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5 text-blue-600" />
          AI Copilot — Rate Negotiation
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          Powered by DAT Benchmarks
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Carrier Name</Label>
              <Input
                placeholder="e.g., Blue Ridge Logistics"
                value={formData.carrier_name}
                onChange={e => handleInputChange('carrier_name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Bid Rate</Label>
              <Input
                type="number"
                placeholder="e.g., 3200"
                value={formData.bid_rate}
                onChange={e => handleInputChange('bid_rate', parseFloat(e.target.value) || 0)}
                min="1"
                step="1"
                required
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Equipment</Label>
              <Select value={formData.equipment_type} onValueChange={v => handleInputChange('equipment_type', v as EquipmentType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dry Van">Dry Van</SelectItem>
                  <SelectItem value="Reefer">Reefer</SelectItem>
                  <SelectItem value="Flatbed">Flatbed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Miles</Label>
              <Input
                type="number"
                placeholder="e.g., 715"
                value={formData.miles}
                onChange={e => handleInputChange('miles', parseInt(e.target.value) || 0)}
                min="1"
                required
              />
            </div>
</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Origin</Label>
              <Input
                placeholder="e.g., Atlanta, GA"
                value={formData.lane_origin}
                onChange={e => handleInputChange('lane_origin', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Destination</Label>
              <Input
                placeholder="e.g., Chicago, IL"
                value={formData.lane_destination}
                onChange={e => handleInputChange('lane_destination', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Weight (lbs)</Label>
              <Input
                type="number"
                placeholder="42000"
                value={formData.weight}
                onChange={e => handleInputChange('weight', parseInt(e.target.value) || 42000)}
                min="0"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-medium">Carrier Score (0-100)</Label>
              <Input
                type="number"
                placeholder="Optional"
                value={formData.carrier_score ?? ''}
                onChange={e => handleInputChange('carrier_score', e.target.value ? parseInt(e.target.value) : undefined)}
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Commodity</Label>
              <Input
                placeholder="General Freight"
                value={formData.commodity}
                onChange={e => handleInputChange('commodity', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Fuel Surcharge / mi</Label>
              <Input
                type="number"
                placeholder="e.g., 0.45"
                value={formData.fuel_surcharge ?? ''}
                onChange={e => handleInputChange('fuel_surcharge', e.target.value ? parseFloat(e.target.value) : undefined)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Get AI Recommendation
              </>
            )}
          </Button>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-4 border-t pt-4 animate-fade-in">
            {/* Decision Banner */}
            <div className={`p-4 rounded-lg border ${decisionConfig?.bg} flex items-center gap-3`}>
              {decisionConfig && decision && (
                <>
                  <decisionConfig.icon className="h-6 w-6 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-lg">{decisionConfig.label}</div>
                    <div className="text-sm opacity-80">{DECISION_DESCRIPTIONS[decision]}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-2xl font-bold">${formatCurrency(result.recommended_rate)}</div>
                    <div className="text-xs opacity-70">Recommended Rate</div>
                  </div>
                </>
              )}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                icon={<DollarSign className="h-5 w-5 text-blue-600" />}
                label="Carrier Bid"
                value={formatCurrency(result.carrier_bid)}
              />
              <MetricCard
                icon={<Target className="h-5 w-5 text-green-600" />}
                label="Market Median"
                value={formatCurrency(result.market_median)}
              />
              <MetricCard
                icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
                label="Variance"
                value={formatPct(result.variance_pct)}
                subValue={result.variance_pct > 0 ? 'Above market' : result.variance_pct < 0 ? 'Below market' : 'At market'}
              />
              <MetricCard
                icon={<Gauge className="h-5 w-5 text-orange-600" />}
                label="Confidence"
                value={`${result.confidence}%`}
              />
            </div>

            {/* Rationale */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <FileText className="h-4 w-4 text-gray-600" />
                AI Rationale
              </div>
              <p className="text-sm text-gray-700">{result.rationale}</p>
            </div>

            {/* Expandable Details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-sm text-blue-600 hover:text-blue-700 py-2"
            >
              <span className="flex items-center gap-1">
                <HelpCircle className="h-4 w-4" />
                Detailed Factors
              </span>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showDetails && (
              <div className="space-y-3 pt-2 border-t animate-slide-down">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {Object.entries(result.factors).map(([key, value]) => (
                    <div key={key} className="p-3 bg-white rounded border">
                      <div className="text-xs font-medium text-gray-500">{key.replace(/_/g, ' ')}</div>
                      <div className="font-mono">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <Separator />
            <div className="flex flex-col sm:flex-row gap-3">
              {decision === 'COUNTER' && (
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => alert(`Dispatch at counter-offer rate: ${formatCurrency(result.recommended_rate)}`)}
                >
                  <Target className="mr-2 h-4 w-4" />
                  Dispatch at Counter Rate
                </Button>
              )}
              {decision === 'ACCEPT' && (
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => alert(`Approve and dispatch at carrier bid: ${formatCurrency(result.carrier_bid)}`)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve at Carrier Bid
                </Button>
              )}
              {decision === 'REJECT' && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => alert('Reject bid and re-source lane')}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject & Re-source
                </Button>
              )}
              <Button variant="outline" onClick={() => setResult(null)}>
                New Analysis
              </Button>
            </div>
          </div>
        )}

        {/* Quick Load Analysis Helper */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Quick Load Analysis
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Select a load from the queue to pre-fill the negotiation form with its details.
          </p>
          <LoadQuickAnalysisForm onAnalyze={setFormData} />
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}

function MetricCard({ icon, label, value, subValue }: MetricCardProps) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <div className="font-bold text-lg font-mono">{value}</div>
      {subValue && <div className="text-xs text-gray-500">{subValue}</div>}
    </div>
  );
}

interface LoadQuickAnalysisFormProps {
  onAnalyze: (data: CarrierBidRequest) => void;
}

function LoadQuickAnalysisForm({ onAnalyze }: LoadQuickAnalysisFormProps) {
  const { pipelines } = usePipelines();
  const [selectedLoadId, setSelectedLoadId] = useState<string>('');
  const [carrierBid, setCarrierBid] = useState<number>(0);
  const [carrierName, setCarrierName] = useState<string>('');

  const pendingLoads = pipelines.filter(p => p.status === 'pending');

  const handleQuickAnalyze = () => {
    const load = pipelines.find(p => p.id === selectedLoadId);
    if (!load) return;

    const equipment = load.equipment?.toLowerCase() || '';
    let equipmentType: EquipmentType = 'Dry Van';
    if (equipment.includes('reefer') || equipment.includes('refrigerated')) equipmentType = 'Reefer';
    else if (equipment.includes('flatbed') || equipment.includes('flat')) equipmentType = 'Flatbed';

    const origin = `${load.origin}, ${load.originState}`;
    const destination = `${load.destination}, ${load.destinationState}`;

    onAnalyze({
      carrier_name: carrierName,
      bid_rate: carrierBid,
      equipment_type: equipmentType,
      lane_origin: origin,
      lane_destination: destination,
      miles: load.miles || 0,
      weight: parseInt(load.weight?.replace(/[^0-9]/g, '') || '42000'),
      commodity: load.commodity || 'General Freight',
    });
  };

  if (pendingLoads.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">
        No pending loads available for quick analysis.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Select Load</Label>
          <Select value={selectedLoadId} onValueChange={setSelectedLoadId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a pending load" />
            </SelectTrigger>
            <SelectContent>
              {pendingLoads.map(load => (
                <SelectItem key={load.id} value={load.id}>
                  {load.id} — {load.origin}, {load.originState} → {load.destination}, {load.destinationState} (${load.rate.toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">Carrier Name</Label>
          <Input
            placeholder="Carrier name"
            value={carrierName}
            onChange={e => setCarrierName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">Carrier Bid Rate</Label>
          <Input
            type="number"
            placeholder="e.g., 3200"
            value={carrierBid}
            onChange={e => setCarrierBid(parseFloat(e.target.value) || 0)}
            min="1"
            step="1"
          />
        </div>
      </div>
      <Button variant="outline" onClick={handleQuickAnalyze} disabled={!selectedLoadId || !carrierBid}>
        Analyze This Load
      </Button>
    </div>
  );
}