import { cn } from "@/lib/utils";

interface SectionLabelProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p" | "label";
}

export function SectionLabel({
  children,
  className,
  as: Tag = "h2",
  ...props
}: SectionLabelProps) {
  return (
    <Tag className={cn("section-label", className)} {...props}>
      {children}
    </Tag>
  );
}
