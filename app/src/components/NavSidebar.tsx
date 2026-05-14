"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",   icon: "⬡" },
  { href: "/features",   label: "Features",    icon: "⬡" },
  { href: "/clients",    label: "Clients",     icon: "⬡" },
  { href: "/approvals",  label: "Approvals",   icon: "⬡" },
  { href: "/batches",    label: "Batches",     icon: "⬡" },
  { href: "/reports",    label: "Reports",     icon: "⬡" },
];

export function NavSidebar({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV.map(({ href, label }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        const badge = label === "Approvals" && pendingApprovals > 0 ? pendingApprovals : null;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {label}
            {badge && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
