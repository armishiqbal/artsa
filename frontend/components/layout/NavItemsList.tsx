"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isNavHrefActive,
  isNavItemActive,
  type NavItem,
} from "@/lib/navigation";

interface NavItemsListProps {
  items: NavItem[];
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
}

export function NavItemsList({
  items,
  onNavigate,
  variant = "desktop",
}: NavItemsListProps) {
  const pathname = usePathname();
  const isMobile = variant === "mobile";

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        if (item.children?.length) {
          const groupActive = isNavItemActive(pathname, item);
          const ParentIcon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                data-active={groupActive ? "true" : "false"}
                className={cn(
                  isMobile
                    ? "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                    : "interactive-nav flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium tracking-[-0.17px] transition-colors",
                  groupActive
                    ? isMobile
                      ? "bg-muted text-foreground"
                      : "text-foreground"
                    : isMobile
                      ? "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
                aria-current={groupActive ? "page" : undefined}
              >
                <ParentIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    groupActive ? "text-foreground" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.name}</span>
              </Link>
              <ul className="mt-0.5 space-y-0.5 border-l border-border/60 ml-5 pl-2">
                {item.children.map((child) => {
                  const ChildIcon = child.icon;
                  const childActive = isNavHrefActive(pathname, child.href);
                  return (
                    <li key={`${item.href}-${child.href}-${child.name}`}>
                      <Link
                        href={child.href}
                        onClick={onNavigate}
                        data-active={childActive ? "true" : "false"}
                        className={cn(
                          isMobile
                            ? "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors"
                            : "interactive-nav flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium tracking-[-0.12px] transition-colors",
                          childActive
                            ? isMobile
                              ? "bg-muted/80 text-foreground"
                              : "text-foreground"
                            : isMobile
                              ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                        aria-current={childActive ? "page" : undefined}
                      >
                        <ChildIcon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            childActive ? "text-foreground" : "text-muted-foreground"
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{child.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        }

        const Icon = item.icon;
        const isActive = isNavHrefActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              data-active={isActive ? "true" : "false"}
              className={cn(
                isMobile
                  ? "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                  : "interactive-nav flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium tracking-[-0.17px] transition-colors",
                isActive
                  ? isMobile
                    ? "bg-muted text-foreground font-medium"
                    : "text-foreground"
                  : isMobile
                    ? "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                aria-hidden
              />
              <span className="truncate">{item.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
