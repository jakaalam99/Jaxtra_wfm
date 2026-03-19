"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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
  salary_type: "Harian" | "Bulanan";
  base_rate: number;
};

export default function KaryawanPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formId, setFormId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formSalaryType, setFormSalaryType] = useState<"Harian" | "Bulanan">("Harian");
  const [formBaseRate, setFormBaseRate] = useState<string>("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name", { ascending: true });
    
    if (data) setEmployees(data as Employee[]);
    setLoading(false);
  };

  const openAddModal = () => {
    setFormId(null);
    setFormName("");
    setFormPosition("");
    setFormSalaryType("Harian");
    setFormBaseRate("0");
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setFormId(emp.id);
    setFormName(emp.name);
    setFormPosition(emp.position);
    setFormSalaryType(emp.salary_type);
    setFormBaseRate(emp.base_rate.toString());
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus karyawan ini? Data absensi terkait juga mungkin akan terhapus.")) return;
    
    await supabase.from("employees").delete().eq("id", id);
    fetchEmployees();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name: formName,
      position: formPosition,
      salary_type: formSalaryType,
      base_rate: parseFloat(formBaseRate),
    };

    if (formId) {
      await supabase.from("employees").update(payload).eq("id", formId);
    } else {
      await supabase.from("employees").insert([payload]);
    }

    setSubmitting(false);
    setIsModalOpen(false);
    fetchEmployees();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Data Karyawan</h2>
          <p className="text-slate-500 text-sm mt-1">Kelola data, posisi, dan tipe gaji karyawan.</p>
        </div>
        <Button onClick={openAddModal} className="shrink-0 gap-2">
          <Plus className="w-4 h-4" />
          Tambah Karyawan
        </Button>
      </div>

      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Memuat data...</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Posisi</TableHead>
                    <TableHead>Tipe Gaji</TableHead>
                    <TableHead className="text-right">Gaji Pokok / Rate</TableHead>
                    <TableHead className="w-[100px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                        Belum ada data karyawan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>{emp.position}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                            emp.salary_type === "Bulanan" 
                              ? "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/10" 
                              : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-inset ring-[var(--color-primary-500)]/20"
                          }`}>
                            {emp.salary_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-emerald-700 font-bold whitespace-nowrap bg-emerald-50/20">
                          Rp {emp.base_rate.toLocaleString("id-ID")}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-2 text-slate-400 hover:text-[var(--color-primary-600)] transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id)}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-slate-100 bg-white">
              {employees.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm italic">Belum ada data karyawan.</div>
              ) : (
                employees.map((emp) => (
                  <div key={emp.id} className="p-4 flex justify-between items-center group active:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900">{emp.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{emp.position}</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span className={emp.salary_type === "Bulanan" ? "text-slate-600" : "text-[var(--color-primary-600)]"}>{emp.salary_type}</span>
                      </div>
                      <div className="text-sm font-bold text-emerald-600">Rp {emp.base_rate.toLocaleString("id-ID")}</div>

                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        onClick={() => openEditModal(emp)}
                        className="h-9 w-9 p-0 text-slate-400 hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleDelete(emp.id)}
                        className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formId ? "Edit Karyawan" : "Tambah Karyawan"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Lengkap"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="John Doe"
          />
          <Input
            label="Posisi / Jabatan"
            required
            value={formPosition}
            onChange={(e) => setFormPosition(e.target.value)}
            placeholder="Mis: Staff Operasional"
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tipe Gaji
            </label>
            <select
              value={formSalaryType}
              onChange={(e) => setFormSalaryType(e.target.value as "Harian" | "Bulanan")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            >
              <option value="Harian">Harian</option>
              <option value="Bulanan">Bulanan</option>
            </select>
          </div>

          <Input
            label={formSalaryType === "Harian" ? "Rate Harian (Rp)" : "Gaji Pokok Bulanan (Rp)"}
            type="number"
            required
            min="0"
            value={formBaseRate}
            onChange={(e) => setFormBaseRate(e.target.value)}
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
