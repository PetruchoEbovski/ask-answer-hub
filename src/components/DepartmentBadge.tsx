import { cn } from "@/lib/utils";

interface DepartmentBadgeProps {
  name: string;
  className?: string;
}

const departmentColors: Record<string, string> = {
  Engineering: "bg-blue-100 text-blue-700 border-blue-200",
  Product: "bg-purple-100 text-purple-700 border-purple-200",
  HR: "bg-pink-100 text-pink-700 border-pink-200",
  Finance: "bg-green-100 text-green-700 border-green-200",
  Marketing: "bg-orange-100 text-orange-700 border-orange-200",
  Operations: "bg-slate-100 text-slate-700 border-slate-200",
  Leadership: "bg-amber-100 text-amber-700 border-amber-200",
};

export function DepartmentBadge({ name, className }: DepartmentBadgeProps) {
  const colorClass = departmentColors[name] || "bg-secondary text-secondary-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        colorClass,
        className
      )}
    >
      {name}
    </span>
  );
}
