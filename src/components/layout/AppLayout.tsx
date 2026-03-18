"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/karyawan": "Manajemen Karyawan",
  "/absensi": "Absensi & Lembur",
  "/kasbon": "Manajemen Kasbon",
  "/penggajian": "Perhitungan Gaji",
};

function getRouteTitle(pathname: string) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith("/karyawan")) return "Manajemen Karyawan";
  if (pathname.startsWith("/absensi")) return "Absensi & Lembur";
  if (pathname.startsWith("/kasbon")) return "Manajemen Kasbon";
  if (pathname.startsWith("/penggajian")) return "Perhitungan Gaji";
  return "Jaxtra Dashboard";
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = getRouteTitle(pathname || "/");

  return (
    <div className="flex h-screen w-full bg-[var(--background)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
