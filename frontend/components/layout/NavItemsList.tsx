"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavHrefActive, isNavItemActive, type NavGroup, type NavItem } from "@/lib/navigation";

interface NavItemsListProps {
  items: NavItem[];
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
}

function visibleFocusable(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-nav-focusable="true"]')].filter(
    (element) => element.offsetParent !== null
  );
}

function NavGroupRow({
  item,
  onNavigate,
  isMobile,
}: {
  item: NavGroup;
  onNavigate?: () => void;
  isMobile: boolean;
}) {
  const pathname = usePathname();
  const groupActive = isNavItemActive(pathname, item);
  const [open, setOpen] = useState(groupActive);
  const ParentIcon = item.icon;
  const panelId = `nav-group-${item.id}`;

  useEffect(() => {
    // Active groups are always visible; when navigation leaves a group,
    // return it to the collapsed default so the sidebar stays scannable.
    setOpen(groupActive);
  }, [groupActive]);

  const onGroupKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <li>
      <button
        type="button"
        data-nav-focusable="true"
        data-nav-group={item.id}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onGroupKeyDown}
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium tracking-[-0.17px] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isMobile && "text-sm",
          groupActive
            ? "bg-muted/70 text-foreground"
            : "text-muted-foreground hover:bg-muted/25 hover:text-foreground/90"
        )}
      >
        <ParentIcon className={cn("h-4 w-4 shrink-0", groupActive && "text-foreground")} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-90"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <ul id={panelId} className="ml-5 mt-0.5 space-y-0.5 border-l border-border/60 pl-2 animate-fade-in motion-reduce:animate-none">
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            const active = isNavHrefActive(pathname, child.href, child.exact);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  data-nav-focusable="true"
                  data-active={active ? "true" : "false"}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-muted/70 text-foreground"
                      : "text-muted-foreground hover:bg-muted/25 hover:text-foreground/90"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <ChildIcon className={cn("h-3.5 w-3.5 shrink-0", active && "text-foreground")} aria-hidden />
                  <span className="truncate">{child.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

export function NavItemsList({ items, onNavigate, variant = "desktop" }: NavItemsListProps) {
  const pathname = usePathname();
  const isMobile = variant === "mobile";
  const listRef = useRef<HTMLUListElement>(null);

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (!target.matches('[data-nav-focusable="true"]')) return;
    const list = listRef.current;
    if (!list) return;
    const focusable = visibleFocusable(list);
    const index = focusable.indexOf(target);
    if (index < 0 || focusable.length === 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? focusable.length - 1
          : event.key === "ArrowDown"
            ? (index + 1) % focusable.length
            : (index - 1 + focusable.length) % focusable.length;
    focusable[nextIndex]?.focus();
  };

  return (
    <ul ref={listRef} className="space-y-0.5" onKeyDown={onListKeyDown}>
      {items.map((item) => {
        if (item.kind === "group") {
          if (item.id === "settings") {
            const Icon = item.icon;
            const active = pathname === "/settings" || pathname.startsWith("/settings/");
            return (
              <li key={item.id}>
                <Link
                  href="/settings"
                  onClick={onNavigate}
                  data-nav-focusable="true"
                  data-active={active ? "true" : "false"}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-medium tracking-[-0.17px] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isMobile && "text-sm",
                    active
                      ? "bg-muted/70 text-foreground"
                      : "text-muted-foreground hover:bg-muted/25 hover:text-foreground/90"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-foreground")} aria-hidden />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          }
          return <NavGroupRow key={item.id} item={item} onNavigate={onNavigate} isMobile={isMobile} />;
        }

        const Icon = item.icon;
        const active = isNavHrefActive(pathname, item.href, item.exact);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              data-nav-focusable="true"
              data-active={active ? "true" : "false"}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-medium tracking-[-0.17px] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isMobile && "text-sm",
                active
                  ? "bg-muted/70 text-foreground"
                  : "text-muted-foreground hover:bg-muted/25 hover:text-foreground/90"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-foreground")} aria-hidden />
              <span className="truncate">{item.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
