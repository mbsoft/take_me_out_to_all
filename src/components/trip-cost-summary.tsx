"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Car, Plane, Ticket, BedDouble, ParkingCircle, ChevronDown, ChevronUp, DollarSign, Loader2 } from "lucide-react";
import { type TripCostBreakdown, formatCurrency } from "@/lib/cost-calculator";

interface TripCostSummaryProps {
  breakdown: TripCostBreakdown | null;
  loading?: boolean;
}

function CostRow({ icon, label, amount }: { icon: React.ReactNode; label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium">{formatCurrency(amount)}</span>
    </div>
  );
}

export function TripCostSummary({ breakdown, loading }: TripCostSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Estimating trip costs...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) return null;

  return (
    <Card>
      <CardContent className="py-3">
        <button
          type="button"
          className="flex w-full items-center justify-between"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold">Estimated Trip Cost</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(breakdown.grandTotal)}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-3 space-y-1 border-t pt-3">
            {breakdown.travel.driving > 0 && (
              <CostRow
                icon={<Car className="h-4 w-4" />}
                label={`Driving (${breakdown.segments.filter(s => s.mode === "car").reduce((s, seg) => s + seg.distanceMiles, 0).toLocaleString()} mi)`}
                amount={breakdown.travel.driving}
              />
            )}
            {breakdown.travel.flights > 0 && (
              <CostRow
                icon={<Plane className="h-4 w-4" />}
                label={`Flights (${breakdown.segments.filter(s => s.mode === "air").length})`}
                amount={breakdown.travel.flights}
              />
            )}
            <CostRow
              icon={<Ticket className="h-4 w-4" />}
              label={`Tickets (${breakdown.tickets.perGame.length} games x 2)`}
              amount={breakdown.tickets.total}
            />
            <CostRow
              icon={<BedDouble className="h-4 w-4" />}
              label={`Hotels (${breakdown.hotels.nights} night${breakdown.hotels.nights !== 1 ? "s" : ""})`}
              amount={breakdown.hotels.total}
            />
            <CostRow
              icon={<ParkingCircle className="h-4 w-4" />}
              label={`Parking (${breakdown.tickets.perGame.length} games)`}
              amount={breakdown.parking.total}
            />
            <div className="flex items-center justify-between border-t pt-2 mt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-bold">{formatCurrency(breakdown.grandTotal)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Estimates based on IRS mileage rate, average hotel &amp; parking costs, and SeatGeek ticket prices.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
