"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  Banknote, 
  Calculator,
  LogOut 
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const MENU_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Karyawan", href: "/karyawan", icon: Users },
  { name: "Absensi & Lembur", href: "/absensi", icon: CalendarCheck },
  { name: "Manajemen Kasbon", href: "/kasbon", icon: Banknote },
  { name: "Penggajian", href: "/penggajian", icon: Calculator },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Jaxtra<span className="text-[var(--color-primary-400)]">.</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">Workforce Management</p>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-[var(--color-primary-500)] text-white font-medium"
                  : "hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
