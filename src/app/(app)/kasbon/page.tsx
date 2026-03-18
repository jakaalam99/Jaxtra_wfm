"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, Banknote, ListPlus } from "lucide-react";
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

type Employee = { id: string; name: string };

type Loan = {
  id: string;
  employee_id: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  employees: Employee; // JOINed
};

export default function KasbonPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Loan Modal
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [newLoanEmpId, setNewLoanEmpId] = useState("");
  const [newLoanAmount, setNewLoanAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Add Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch active loans and employee details
    const { data: loanData } = await supabase
      .from("loans")
      .select(`
        *,
        employees ( id, name )
      `)
      .order("created_at", { ascending: false });
    
    // Fetch employees for dropdown
    const { data: empData } = await supabase
      .from("employees")
      .select("id, name")
      .order("name", { ascending: true });

    if (loanData) setLoans(loanData as any);
    if (empData) setEmployees(empData);
    setLoading(false);
  };

  const handeAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    await supabase.from("loans").insert([
      { employee_id: newLoanEmpId, total_amount: parseFloat(newLoanAmount) }
    ]);
    
    setSubmitting(false);
    setIsAddLoanOpen(false);
    setNewLoanAmount("");
    setNewLoanEmpId("");
    fetchData();
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    
    setSubmitting(true);
    const pAmt = parseFloat(paymentAmount);
    
    // 1. Insert payment record
    await supabase.from("loan_payments").insert([
      { loan_id: selectedLoan.id, amount: pAmt, payment_date: format(new Date(), "yyyy-MM-dd") }
    ]);

    // 2. Update paid_amount on loan
    await supabase.from("loans")
      .update({ paid_amount: selectedLoan.paid_amount + pAmt })
      .eq("id", selectedLoan.id);

    setSubmitting(false);
    setIsPaymentOpen(false);
    setPaymentAmount("");
    setSelectedLoan(null);
    fetchData();
  };

  const openPaymentModal = (loan: Loan) => {
    setSelectedLoan(loan);
    setPaymentAmount((loan.total_amount - loan.paid_amount).toString());
    setIsPaymentOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Manajemen Kasbon</h2>
          <p className="text-slate-500 text-sm mt-1">Lacak peminjaman uang dan pembayaran karyawan.</p>
        </div>
        
        <Button onClick={() => setIsAddLoanOpen(true)} className="shrink-0 gap-2">
          <Plus className="w-4 h-4" />
          Kasbon Baru
        </Button>
      </div>

      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Memuat data kasbon...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Karyawan</TableHead>
                <TableHead className="text-right">Total Pinjaman</TableHead>
                <TableHead className="text-right">Sudah Dibayar</TableHead>
                <TableHead className="text-right">Sisa Kasbon</TableHead>
                <TableHead className="w-[120px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    Belum ada data kasbon.
                  </TableCell>
                </TableRow>
              ) : (
                loans.map((loan) => {
                  const sisa = loan.total_amount - loan.paid_amount;
                  const isLunas = sisa <= 0;

                  return (
                    <TableRow key={loan.id} className={isLunas ? "bg-slate-50/50 opacity-80" : ""}>
                      <TableCell>{format(new Date(loan.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell className="font-medium">{loan.employees?.name || "Unknown"}</TableCell>
                      <TableCell className="text-right text-slate-700">Rp {loan.total_amount.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right text-emerald-600">Rp {loan.paid_amount.toLocaleString("id-ID")}</TableCell>
                      <TableCell className={`text-right font-medium ${isLunas ? "text-slate-400" : "text-red-600"}`}>
                        {isLunas ? "Lunas" : `Rp ${sisa.toLocaleString("id-ID")}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isLunas && (
                          <Button 
                            variant="secondary" 
                            className="h-8 px-3 py-1 text-xs"
                            onClick={() => openPaymentModal(loan)}
                          >
                            Bayar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Loan Modal */}
      <Modal isOpen={isAddLoanOpen} onClose={() => setIsAddLoanOpen(false)} title="Tambah Kasbon Baru">
        <form onSubmit={handeAddLoan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Karyawan Peminjam
            </label>
            <select
              required
              value={newLoanEmpId}
              onChange={(e) => setNewLoanEmpId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            >
              <option value="" disabled>Pilih Karyawan</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          
          <Input
            label="Total Pinjaman (Rp)"
            type="number"
            min="1000"
            required
            value={newLoanAmount}
            onChange={(e) => setNewLoanAmount(e.target.value)}
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsAddLoanOpen(false)}>Batal</Button>
            <Button type="submit" isLoading={submitting}>Simpan Kasbon</Button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title="Bayar Kasbon">
        {selectedLoan && (
          <form onSubmit={handleAddPayment} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Peminjam:</span>
                <span className="font-medium">{selectedLoan.employees?.name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Sisa Kasbon Sebelumnya:</span>
                <span className="font-medium text-red-600">Rp {(selectedLoan.total_amount - selectedLoan.paid_amount).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <Input
              label="Jumlah Pembayaran (Rp)"
              type="number"
              min="1000"
              max={selectedLoan.total_amount - selectedLoan.paid_amount}
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />

            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsPaymentOpen(false)}>Batal</Button>
              <Button type="submit" isLoading={submitting}>Konfirmasi Pembayaran</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
