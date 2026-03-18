"use client";

import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Users, CalendarCheck, Clock, Banknote, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    hadirHariIni: 0,
    totalKaryawan: 0,
    lemburBulanIni: 0,
    kasbonAktif: 0,
  });
  
  const [topLembur, setTopLembur] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const startMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const endMonth = format(endOfMonth(new Date()), "yyyy-MM-dd");

    try {
      // 1. Total Karyawan
      const { count: totalKaryawan } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true });

      // 2. Hadir Hari Ini
      const { count: hadirHariIni } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("date", today)
        .eq("status", "Hadir");

      // 3. Lembur Bulan Ini & Top Lembur
      // To get total and top, fetch data for the month
      const { data: attBulanIni } = await supabase
        .from("attendance")
        .select("employee_id, overtime_hours, employees(name)")
        .gte("date", startMonth)
        .lte("date", endMonth)
        .gt("overtime_hours", 0);

      let totalLembur = 0;
      const lemburMap: Record<string, { name: string, hours: number }> = {};

      attBulanIni?.forEach(a => {
        const hrs = Number(a.overtime_hours) || 0;
        totalLembur += hrs;
        if (!lemburMap[a.employee_id]) {
          lemburMap[a.employee_id] = { name: a.employees?.name || "Unknown", hours: 0 };
        }
        lemburMap[a.employee_id].hours += hrs;
      });

      // Sort map for Top 5
      const topArr = Object.values(lemburMap).sort((a, b) => b.hours - a.hours).slice(0, 5);

      // 4. Kasbon Aktif
      const { data: loans } = await supabase.from("loans").select("total_amount, paid_amount");
      const kasbonAktif = loans?.reduce((sum, l) => sum + (Number(l.total_amount) - Number(l.paid_amount)), 0) || 0;

      setStats({
        totalKaryawan: totalKaryawan || 0,
        hadirHariIni: hadirHariIni || 0,
        lemburBulanIni: totalLembur,
        kasbonAktif
      });
      setTopLembur(topArr);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-500)] mb-4" />
        <p>Memuat Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Ringkasan operasional harian dan bulanan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Hadir Hari Ini</p>
              <p className="text-2xl font-bold text-slate-800">
                {stats.hadirHariIni} <span className="text-lg font-normal text-slate-500">/ {stats.totalKaryawan}</span>
              </p>
            </div>
          </div>
        </div>
        
        <div className="glass-panel p-6 border-l-4 border-l-[var(--color-primary-500)]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-100 text-[var(--color-primary-600)] rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Karyawan</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalKaryawan}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Lembur Bulan Ini</p>
              <p className="text-2xl font-bold text-slate-800">{stats.lemburBulanIni} <span className="text-lg font-normal text-slate-500">Jam</span></p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Sisa Kasbon Aktif</p>
              <p className="text-2xl font-bold text-slate-800">Rp {stats.kasbonAktif.toLocaleString("id-ID")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 min-h-[300px]">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Top Lembur Karyawan (Bulan Ini)
          </h3>
          
          {topLembur.length === 0 ? (
            <p className="text-slate-500 text-center mt-10">Belum ada data lembur bulan ini.</p>
          ) : (
            <div className="space-y-4">
              {topLembur.map((tl, i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                      #{i + 1}
                    </div>
                    <span className="font-medium text-slate-700">{tl.name}</span>
                  </div>
                  <span className="font-semibold text-[var(--color-primary-600)] bg-cyan-50 px-3 py-1 rounded-full">
                    {tl.hours} Jam
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
