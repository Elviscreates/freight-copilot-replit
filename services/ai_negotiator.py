from typing import Literal, Optional
from pydantic import BaseModel, Field


class CarrierBidRequest(BaseModel):
    """Request model for carrier bid evaluation."""
    carrier_name: str
    bid_rate: float = Field(..., gt=0, description="Carrier's bid rate in USD")
    equipment_type: Literal["Dry Van", "Reefer", "Flatbed"] = Field(..., description="Equipment type")
    lane_origin: str = Field(..., description="Origin city, state")
    lane_destination: str = Field(..., description="Destination city, state")
    miles: int = Field(..., gt=0, description="Distance in miles")
    weight: int = Field(default=42000, ge=0, description="Weight in lbs")
    commodity: str = Field(default="General Freight", description="Commodity type")
    carrier_score: Optional[int] = Field(default=None, ge=0, le=100, description="Carrier quality score (0-100)")
    fuel_surcharge: Optional[float] = Field(default=None, ge=0, description="Fuel surcharge per mile")


class NegotiationResponse(BaseModel):
    """Response model for AI negotiation recommendation."""
    decision: Literal["ACCEPT", "COUNTER", "REJECT"]
    recommended_rate: float = Field(..., description="AI recommended counter-offer rate")
    market_median: float = Field(..., description="DAT market median rate for this lane/equipment")
    carrier_bid: float = Field(..., description="Original carrier bid rate")
    variance_pct: float = Field(..., description="Percentage variance from market median")
    confidence: int = Field(..., ge=0, le=100, description="AI confidence in recommendation (0-100)")
    rationale: str = Field(..., description="Human-readable explanation of the decision")
    savings_vs_bid: float = Field(..., description="Potential savings vs carrier bid")
    equipment_type: str = Field(..., description="Equipment type analyzed")
    lane: str = Field(..., description="Lane description (origin to destination)")
    factors: dict = Field(default_factory=dict, description="Detailed scoring factors")


# DAT Market Benchmarks (simulated - in production would come from DAT API)
DAT_BENCHMARKS = {
    "Dry Van": {
        "base_rate_per_mile": 2.10,
        "regional_adjustments": {
            "SE": 1.05,  # Southeast premium
            "MW": 0.98,  # Midwest discount
            "NE": 1.08,  # Northeast premium
            "SW": 1.02,  # Southwest slight premium
            "NW": 0.95,  # Northwest discount
        },
        "seasonal_factors": {
            "Q1": 0.95,
            "Q2": 1.00,
            "Q3": 1.05,
            "Q4": 1.10,
        }
    },
    "Reefer": {
        "base_rate_per_mile": 2.65,
        "regional_adjustments": {
            "SE": 1.08,
            "MW": 1.00,
            "NE": 1.12,
            "SW": 1.05,
            "NW": 0.98,
        },
        "seasonal_factors": {
            "Q1": 0.90,
            "Q2": 1.05,
            "Q3": 1.15,
            "Q4": 1.00,
        }
    },
    "Flatbed": {
        "base_rate_per_mile": 2.45,
        "regional_adjustments": {
            "SE": 1.02,
            "MW": 1.00,
            "NE": 1.05,
            "SW": 1.08,
            "NW": 1.00,
        },
        "seasonal_factors": {
            "Q1": 0.92,
            "Q2": 1.08,
            "Q3": 1.12,
            "Q4": 1.00,
        }
    }
}


def get_region_from_state(state: str) -> str:
    """Map state to region for benchmark adjustments."""
    se_states = {"FL", "GA", "AL", "SC", "NC", "TN", "MS", "LA"}
    mw_states = {"IL", "IN", "OH", "MI", "WI", "MN", "IA", "MO", "KS", "NE", "SD", "ND"}
    ne_states = {"ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "DC"}
    sw_states = {"TX", "OK", "NM", "AZ", "NV", "UT", "CO"}
    
    state = state.upper().strip()
    if state in se_states:
        return "SE"
    elif state in mw_states:
        return "MW"
    elif state in ne_states:
        return "NE"
    elif state in sw_states:
        return "SW"
    else:
        return "NW"


def get_seasonal_factor() -> float:
    """Get current seasonal factor based on quarter."""
    from datetime import datetime
    month = datetime.now().month
    if month in [1, 2, 3]:
        return "Q1"
    elif month in [4, 5, 6]:
        return "Q2"
    elif month in [7, 8, 9]:
        return "Q3"
    else:
        return "Q4"


def calculate_dat_median(request: CarrierBidRequest) -> float:
    """Calculate DAT market median rate for the given lane and equipment."""
    equipment_data = DAT_BENCHMARKS.get(request.equipment_type, DAT_BENCHMARKS["Dry Van"])
    
    # Determine origin region (use origin state)
    origin_state = request.lane_origin.split(",")[-1].strip() if "," in request.lane_origin else ""
    region = get_region_from_state(origin_state)
    
    base_rate = equipment_data["base_rate_per_mile"]
    regional_adj = equipment_data["regional_adjustments"].get(region, 1.0)
    seasonal_adj = equipment_data["seasonal_factors"].get(get_seasonal_factor(), 1.0)
    
    # Weight adjustment (heavier loads = slightly higher rate per mile)
    weight_factor = 1.0
    if request.weight > 44000:
        weight_factor = 1.03
    elif request.weight > 40000:
        weight_factor = 1.015
    
    rate_per_mile = base_rate * regional_adj * seasonal_adj * weight_factor
    total_rate = rate_per_mile * request.miles
    
    # Add fuel surcharge if provided
    if request.fuel_surcharge:
        total_rate += request.fuel_surcharge * request.miles
    
    return round(total_rate, 2)


def evaluate_bid(request: CarrierBidRequest) -> NegotiationResponse:
    """
    Evaluate a carrier bid against market benchmarks and return AI recommendation.
    
    Decision Logic:
    - ACCEPT: Bid is at or below market median (good deal)
    - COUNTER: Bid is 1-15% above market median (negotiate down)
    - REJECT: Bid is >15% above market median (unreasonable)
    """
    market_median = calculate_dat_median(request)
    carrier_bid = request.bid_rate
    variance_pct = ((carrier_bid - market_median) / market_median) * 100
    
    # Determine decision based on variance from market
    if variance_pct <= 0:
        decision = "ACCEPT"
        recommended_rate = carrier_bid
        confidence = min(95, 85 + abs(int(variance_pct * 2)))
    elif variance_pct <= 5:
        decision = "COUNTER"
        recommended_rate = round(market_median * 1.02, 2)  # Slightly above median
        confidence = 80
    elif variance_pct <= 10:
        decision = "COUNTER"
        recommended_rate = round(market_median * 1.0, 2)  # At median
        confidence = 75
    elif variance_pct <= 15:
        decision = "COUNTER"
        recommended_rate = round(market_median * 0.98, 2)  # Below median
        confidence = 70
    else:
        decision = "REJECT"
        recommended_rate = round(market_median * 0.95, 2)  # Well below median
        confidence = 85
    
    savings_vs_bid = carrier_bid - recommended_rate
    
    # Build rationale
    if decision == "ACCEPT":
        rationale = (
            f"Carrier bid of ${carrier_bid:,.2f} is {abs(variance_pct):.1f}% "
            f"below the DAT market median of ${market_median:,.2f} for this "
            f"{request.equipment_type} lane. This represents a favorable rate."
        )
    elif decision == "COUNTER":
        rationale = (
            f"Carrier bid of ${carrier_bid:,.2f} is {variance_pct:.1f}% "
            f"above the DAT market median of ${market_median:,.2f}. "
            f"Recommend counter-offer of ${recommended_rate:,.2f} "
            f"to align with current market rates for {request.equipment_type} "
            f"on this lane."
        )
    else:  # REJECT
        rationale = (
            f"Carrier bid of ${carrier_bid:,.2f} exceeds the DAT market median "
            f"of ${market_median:,.2f} by {variance_pct:.1f}%, which is well "
            f"above acceptable thresholds. Recommend rejecting and re-sourcing "
            f"this lane at market rates."
        )
    
    # Carrier score factor
    carrier_score_factor = "Unknown"
    if request.carrier_score is not None:
        if request.carrier_score >= 90:
            carrier_score_factor = "Excellent carrier (score ≥90) - premium justified"
        elif request.carrier_score >= 80:
            carrier_score_factor = "Good carrier (score 80-89) - minor premium acceptable"
        elif request.carrier_score >= 70:
            carrier_score_factor = "Average carrier (score 70-79) - negotiate to market"
        else:
            carrier_score_factor = "Below-average carrier (score <70) - significant discount expected"
    
    # Build factors dict
    factors = {
        "market_median": market_median,
        "carrier_bid": carrier_bid,
        "variance_pct": round(variance_pct, 1),
        "equipment_type": request.equipment_type,
        "lane_distance_miles": request.miles,
        "weight_lbs": request.weight,
        "origin_region": get_region_from_state(
            request.lane_origin.split(",")[-1].strip() if "," in request.lane_origin else ""
        ),
        "seasonal_quarter": get_seasonal_factor(),
        "carrier_score": request.carrier_score,
        "carrier_score_factor": carrier_score_factor,
        "fuel_surcharge_per_mile": request.fuel_surcharge,
    }
    
    lane_desc = f"{request.lane_origin} → {request.lane_destination}"
    
    return NegotiationResponse(
        decision=decision,
        recommended_rate=recommended_rate,
        market_median=market_median,
        carrier_bid=carrier_bid,
        variance_pct=round(variance_pct, 1),
        confidence=confidence,
        rationale=rationale,
        savings_vs_bid=round(savings_vs_bid, 2),
        equipment_type=request.equipment_type,
        lane=lane_desc,
        factors=factors,
    )


class AINegotiatorService:
    """Service class for AI-powered rate negotiation."""
    
    @staticmethod
    def evaluate(request: CarrierBidRequest) -> NegotiationResponse:
        """Evaluate a carrier bid and return negotiation recommendation."""
        return evaluate_bid(request)
    
    @staticmethod
    def get_market_median(equipment_type: str, origin: str, destination: str, miles: int, weight: int = 42000) -> float:
        """Get DAT market median rate for a lane."""
        request = CarrierBidRequest(
            carrier_name="",
            bid_rate=0,
            equipment_type=equipment_type,
            lane_origin=origin,
            lane_destination=destination,
            miles=miles,
            weight=weight,
        )
        return calculate_dat_median(request)