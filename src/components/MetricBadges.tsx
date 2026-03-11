import { TrendDirection } from "@/types/dashboard";
import { ArrowUp, ArrowDown, ArrowRight, Minus } from "lucide-react";

export function TrendIcon({ trend, size = 16 }: { trend: TrendDirection; size?: number }) {
  switch (trend) {
    case "up": return <ArrowUp className="trend-up" style={{ width: size, height: size }} />;
    case "down": return <ArrowDown className="trend-down" style={{ width: size, height: size }} />;
    case "stable": return <ArrowRight className="trend-stable" style={{ width: size, height: size }} />;
    default: return <Minus className="text-muted-foreground" style={{ width: size, height: size }} />;
  }
}

export function CategoryBadge({ cat }: { cat: string | null }) {
  if (!cat) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    A: "bg-category-a/15 category-a",
    B: "bg-category-b/15 category-b",
    C: "bg-category-c/15 category-c",
  };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${colors[cat] || ""}`}>
      {cat}
    </span>
  );
}

export function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const isPositive = value > 0;
  const isNeg = value < 0;
  return (
    <span className={`text-xs font-medium ${isPositive ? "trend-up" : isNeg ? "trend-down" : "trend-stable"}`}>
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}
