import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavSidebar } from "@/components/NavSidebar";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const pendingApprovals = await prisma.betaEnrollment.count({
    where: { csmApprovalStatus: "pending" },
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar — hidden on mobile, shown on md+ */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-gray-200 md:bg-white md:fixed md:inset-y-0">
        <div className="flex h-14 items-center border-b border-gray-200 px-6">
          <span className="text-sm font-semibold text-gray-900">Beta Tracker</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavSidebar pendingApprovals={pendingApprovals} />
        </div>
        <div className="border-t border-gray-200 px-4 py-3">
          <p className="truncate text-xs text-gray-500">{session.user.email}</p>
          <p className="text-xs font-medium text-gray-700 capitalize">{session.user.role}</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:ml-56">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 md:hidden">
          <span className="text-sm font-semibold text-gray-900">Beta Tracker</span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
