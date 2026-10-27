import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; match: (path: string) => boolean };

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, className: "size-5" } as const;

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Timeline",
    match: (p) => p === "/",
    icon: (
      <svg {...iconProps}>
        <path d="M4 6h9M7 12h11M5 18h7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    match: (p) => p.startsWith("/clients") || p.startsWith("/projects"),
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M16 5.5a3 3 0 010 5.6M18 14.5c1.3.7 2.2 2.2 2.5 4.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "Expenses",
    match: (p) => p.startsWith("/expenses"),
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="6" width="17" height="12.5" rx="2" />
        <path d="M3.5 10h17M7 14.5h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/partners",
    label: "Partners",
    match: (p) => p.startsWith("/partners"),
    icon: (
      <svg {...iconProps}>
        <path d="M4 20V9l8-5 8 5v11" strokeLinejoin="round" />
        <path d="M9 20v-6h6v6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    match: (p) => p.startsWith("/settings"),
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];
