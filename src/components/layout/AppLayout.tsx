"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { supabase } from "@/lib/supabase";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/karyawan": "Manajemen Karyawan",
  "/absensi": "Absensi & Lembur",
  "/kasbon": "Manajemen Kasbon",
  "/penggajian": "Perhitungan Gaji",
  "/admin": "Admin Portal"
};

function getRouteTitle(pathname: string) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith("/karyawan")) return "Manajemen Karyawan";
  if (pathname.startsWith("/absensi")) return "Absensi & Lembur";
  if (pathname.startsWith("/kasbon")) return "Manajemen Kasbon";
  if (pathname.startsWith("/penggajian")) return "Perhitungan Gaji";
  if (pathname.startsWith("/admin")) return "Admin Portal";
  return "Jaxtra Dashboard";
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = getRouteTitle(pathname || "/");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [role, setRole] = useState<string>("user");
  const [headerLogo, setHeaderLogo] = useState<{ url: string | null; width: number }>({ url: null, width: 150 });

  useEffect(() => {
    const fetchGlobals = async () => {
      const { data } = await supabase.from("app_settings")
        .select("header_logo_url, header_logo_width")
        .eq("id", "global")
        .single();
      if (data) {
        setHeaderLogo({ url: data.header_logo_url, width: data.header_logo_width || 150 });
      }
    };
    fetchGlobals();
  }, []);

  useEffect(() => {
    const trackActivity = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Just select the role to avoid race conditions with login upserts
        // and update activity timestamp only if needed or just periodically
        const { data: profile } = await supabase.from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        
        if (profile?.role) {
          setRole(profile.role.toLowerCase());
        }

        // Silent update for last action
        await supabase.from("profiles").update({ last_action_at: new Date().toISOString() }).eq("id", session.user.id);
      }
    };
    trackActivity();
  }, [pathname]);

  return (
    <div className="flex h-screen w-full bg-[var(--background)] overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} role={role} />
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full lg:min-w-0">
        <Header 
          title={title} 
          logoUrl={headerLogo.url} 
          logoWidth={headerLogo.width}
          onMenuClick={() => setIsSidebarOpen(true)} 
        />
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
