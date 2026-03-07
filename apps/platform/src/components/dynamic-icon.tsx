import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
}

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>;

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const Icon = iconMap[name] ?? LucideIcons.Box;
  return <Icon {...props} />;
}

// Full gradient map from CHS — maps base color to 135deg gradient (light→dark)
export const ICON_GRADIENTS: Record<string, string> = {
  "#2196F3": "linear-gradient(135deg, #42A5F5 0%, #1565C0 100%)",
  "#4CAF50": "linear-gradient(135deg, #66BB6A 0%, #2E7D32 100%)",
  "#9C27B0": "linear-gradient(135deg, #AB47BC 0%, #6A1B9A 100%)",
  "#FF9800": "linear-gradient(135deg, #FFA726 0%, #E65100 100%)",
  "#607D8B": "linear-gradient(135deg, #78909C 0%, #37474F 100%)",
  "#E91E63": "linear-gradient(135deg, #EC407A 0%, #AD1457 100%)",
  "#00BCD4": "linear-gradient(135deg, #26C6DA 0%, #00838F 100%)",
  "#795548": "linear-gradient(135deg, #8D6E63 0%, #4E342E 100%)",
  "#3F51B5": "linear-gradient(135deg, #5C6BC0 0%, #283593 100%)",
  "#009688": "linear-gradient(135deg, #26A69A 0%, #00695C 100%)",
  "#F44336": "linear-gradient(135deg, #EF5350 0%, #C62828 100%)",
  "#3b82f6": "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
  "#0891B2": "linear-gradient(135deg, #22d3ee 0%, #0e7490 100%)",
  "#16A34A": "linear-gradient(135deg, #4ade80 0%, #15803d 100%)",
  "#DC2626": "linear-gradient(135deg, #f87171 0%, #b91c1c 100%)",
  "#7C3AED": "linear-gradient(135deg, #a78bfa 0%, #6d28d9 100%)",
  "#DB2777": "linear-gradient(135deg, #f472b6 0%, #be185d 100%)",
  "#9333EA": "linear-gradient(135deg, #c084fc 0%, #7e22ce 100%)",
  "#2563EB": "linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)",
  "#4F46E5": "linear-gradient(135deg, #818cf8 0%, #4338ca 100%)",
  "#F59E0B": "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
  "#EA580C": "linear-gradient(135deg, #fb923c 0%, #c2410c 100%)",
  "#0F172A": "linear-gradient(135deg, #334155 0%, #0F172A 100%)",
};

export function getGradient(color: string): string {
  return ICON_GRADIENTS[color] || `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`;
}
