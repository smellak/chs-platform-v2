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
