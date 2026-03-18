"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Save, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

type Employee = {
  id: string;
  name: string;
  position: string;
};

type AttendanceRecord = {
  id?: string;
  employee_id: string;
  date: string;
  status: "Hadir" | "Tidak Hadir";
  overtime_hours: number;
  notes: string;
};

export default function AbsensiPage() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData(date);
  }, [date]);

  const fetchData = async (selectedDate: string) => {
    setLoading(true);
    
    // Fetch all employees
    const { data: emps } = await supabase
      .from("employees")
      .select("id, name, position")
      .order("name", { ascending: true });
      
    if (emps) setEmployees(emps);

    // Fetch attendance for this date
    const { data: attData } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", selectedDate);

    const newMap: Record<string, AttendanceRecord> = {};
    if (emps) {
      emps.forEach((emp) => {
        const existing = attData?.find((a) => a.employee_id === emp.id);
        if (existing) {
          newMap[emp.id] = { ...existing };
        } else {
          // Default state if not yet recorded
          newMap[emp.id] = {
            employee_id: emp.id,
            date: selectedDate,
            status: "Hadir", // Default
            overtime_hours: 0,
            notes: "",
          };
        }
      });
    }
    
    setAttendanceMap(newMap);
    setLoading(false);
  };

  const handleStatusToggle = (empId: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        status: prev[empId].status === "Hadir" ? "Tidak Hadir" : "Hadir",
      },
    }));
  };

  const handleChange = (empId: string, field: keyof AttendanceRecord, value: any) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value,
      },
    }));
  };

  const handeSaveAll = async () => {
    setSaving(true);
    
    const recordsToUpsert = Object.values(attendanceMap).map(record => {
      // If we don't have an ID yet, we omit it so Supabase creates it, or use upsert
      // But upsert on unique constraint (employee_id, date) is safer
      const payload: any = {
        employee_id: record.employee_id,
        date: record.date,
        status: record.status,
        overtime_hours: record.overtime_hours,
        notes: record.notes || null
      };
      if (record.id) {
        payload.id = record.id;
      }
      return payload;
    });

    // Supabase upsert requires specifying the unique constraint columns if conflict resolution is needed
    const { error } = await supabase
      .from("attendance")
      .upsert(recordsToUpsert, { onConflict: "employee_id, date" });

    if (!error) {
      alert("Data absensi berhasil disimpan!");
      fetchData(date); // Refresh to get IDs
    } else {
      alert("Gagal menyimpan data: " + error.message);
    }
    
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Absensi & Lembur</h2>
          <p className="text-slate-500 text-sm mt-1">Catat kehadiran dan jam lembur harian.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handeSaveAll} isLoading={saving} className="shrink-0 gap-2">
            <Save className="w-4 h-4" />
            Simpan Absensi
          </Button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-[var(--color-primary-500)]" />
            <p>Memuat data absensi...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Karyawan</TableHead>
                  <TableHead className="w-[150px] text-center">Status</TableHead>
                  <TableHead className="w-[150px]">Lembur (Jam)</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                      Belum ada data karyawan. Tambahkan karyawan terlebih dahulu.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => {
                    const record = attendanceMap[emp.id];
                    if (!record) return null;

                    const isHadir = record.status === "Hadir";

                    return (
                      <TableRow key={emp.id} className={!isHadir ? "bg-red-50/30" : ""}>
                        <TableCell>
                          <div className="font-medium text-slate-900">{emp.name}</div>
                          <div className="text-xs text-slate-500">{emp.position}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleStatusToggle(emp.id)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors w-full ${
                              isHadir 
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                          >
                            {record.status}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={record.overtime_hours || ""}
                            onChange={(e) => handleChange(emp.id, "overtime_hours", parseFloat(e.target.value) || 0)}
                            disabled={!isHadir}
                            className={!isHadir ? "opacity-50" : ""}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={record.notes || ""}
                            onChange={(e) => handleChange(emp.id, "notes", e.target.value)}
                            placeholder="Opsional..."
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
