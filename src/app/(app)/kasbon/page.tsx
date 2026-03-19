"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
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
  employees: Employee; 
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

  // History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [
      { data: loanData },
      { data: empData }
    ] = await Promise.all([
      supabase.from("loans").select("*, employees ( id, name )").order("created_at", { ascending: false }),
      supabase.from("employees").select("id, name").order("name", { ascending: true })
    ]);

    if (loanData) setLoans(loanData as any);
    if (empData) setEmployees(empData);
    setLoading(false);
  };

  const handeAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await supabase.from("loans").insert([{ employee_id: newLoanEmpId, total_amount: parseFloat(newLoanAmount) }]);
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
    
    await supabase.from("loan_payments").insert([{ loan_id: selectedLoan.id, amount: pAmt, payment_date: format(new Date(), "yyyy-MM-dd") }]);
    await supabase.from("loans").update({ paid_amount: selectedLoan.paid_amount + pAmt }).eq("id", selectedLoan.id);

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

  const openHistoryModal = async (loan: Loan) => {
    setSelectedLoan(loan);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("loan_payments")
      .select("*")
      .eq("loan_id", loan.id)
      .order("payment_date", { ascending: false });
    if (data) setPaymentHistory(data);
    setHistoryLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Manajemen Kasbon</h2>
          <p className="text-slate-500 text-sm mt-1">Lacak peminjaman uang dan pembayaran karyawan.</p>
        </div>
        <Button onClick={() => setIsAddLoanOpen(true)} className="shrink-0 gap-2">
          <Plus className="w-4 h-4" /> Kasbon Baru
        </Button>
      </div>

      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Memuat data kasbon...</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama Karyawan</TableHead>
                    <TableHead className="text-right">Total Pinjaman</TableHead>
                    <TableHead className="text-right">Sudah Dibayar</TableHead>
                    <TableHead className="text-right">Sisa Kasbon</TableHead>
                    <TableHead className="w-[180px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-500">Belum ada data kasbon.</TableCell></TableRow>
                  ) : (
                    loans.map((loan) => {
                      const sisa = loan.total_amount - loan.paid_amount;
                      const isLunas = sisa <= 0;
                      return (
                        <TableRow key={loan.id} className={isLunas ? "bg-slate-50/50 opacity-80" : ""}>
                          <TableCell>{format(new Date(loan.created_at), "dd MMM yyyy")}</TableCell>
                          <TableCell className="font-medium">{loan.employees?.name || "Unknown"}</TableCell>
                          <TableCell className="text-right">Rp {loan.total_amount.toLocaleString("id-ID")}</TableCell>
                          <TableCell className="text-right text-emerald-700 font-bold whitespace-nowrap bg-emerald-50/30">Rp {loan.paid_amount.toLocaleString("id-ID")}</TableCell>
                          <TableCell className={`text-right font-bold whitespace-nowrap ${isLunas ? "text-slate-400 bg-slate-50/50" : "text-red-700 bg-red-50/30"}`}>
                            {isLunas ? "Lunas" : `Rp ${sisa.toLocaleString("id-ID")}`}
                          </TableCell>


                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" className="h-8 px-2 text-xs text-slate-500" onClick={() => openHistoryModal(loan)}>Details</Button>
                              {!isLunas && <Button variant="secondary" className="h-8 px-3 py-1 text-xs" onClick={() => openPaymentModal(loan)}>Bayar</Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-slate-100 bg-white">
              {loans.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm italic">Belum ada data kasbon.</div>
              ) : (
                loans.map((loan) => {
                  const sisa = loan.total_amount - loan.paid_amount;
                  const isLunas = sisa <= 0;
                  return (
                    <div key={loan.id} className={`p-4 space-y-3 transition-colors ${isLunas ? "bg-slate-50/50" : ""}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{format(new Date(loan.created_at), "dd MMM yyyy")}</div>
                          <h4 className="font-bold text-slate-900 leading-tight">{loan.employees?.name || "Unknown"}</h4>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${isLunas ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-600"}`}>
                          {isLunas ? "Lunas" : "Aktif"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[9px] text-slate-400 block mb-0.5 uppercase font-bold">Total</span>
                          <span className="text-xs font-semibold text-slate-600">Rp {loan.total_amount.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[9px] text-slate-400 block mb-0.5 uppercase font-bold">Bayar</span>
                          <span className="text-xs font-semibold text-emerald-600">Rp {loan.paid_amount.toLocaleString("id-ID")}</span>
                        </div>
                        <div className={isLunas ? "bg-slate-50 p-2 rounded-lg" : "bg-red-50 p-2 rounded-lg"}>
                          <span className="text-[9px] text-slate-400 block mb-0.5 uppercase font-bold">Sisa</span>
                          <span className={`text-xs font-bold ${isLunas ? "text-slate-500" : "text-red-700"}`}>
                            {isLunas ? "-" : `Rp ${sisa.toLocaleString("id-ID")}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button 
                          variant="ghost" 
                          className="flex-1 h-9 text-xs text-slate-500 border border-slate-200" 
                          onClick={() => openHistoryModal(loan)}
                        >
                          Riwayat Details
                        </Button>
                        {!isLunas && (
                          <Button 
                            variant="secondary" 
                            className="flex-1 h-9 text-xs" 
                            onClick={() => openPaymentModal(loan)}
                          >
                            Bayar Cicilan
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={isAddLoanOpen} onClose={() => setIsAddLoanOpen(false)} title="Tambah Kasbon Baru">
        <form onSubmit={handeAddLoan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Karyawan Peminjam</label>
            <select required value={newLoanEmpId} onChange={(e) => setNewLoanEmpId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
              <option value="" disabled>Pilih Karyawan</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <Input label="Total Pinjaman (Rp)" type="number" min="1000" required value={newLoanAmount} onChange={(e) => setNewLoanAmount(e.target.value)} />
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsAddLoanOpen(false)}>Batal</Button>
            <Button type="submit" isLoading={submitting}>Simpan Kasbon</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title="Bayar Kasbon">
        {selectedLoan && (
          <form onSubmit={handleAddPayment} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm mb-4">
              <div className="flex justify-between mb-1"><span className="text-slate-500">Peminjam:</span><span className="font-medium">{selectedLoan.employees?.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sisa Kasbon Sebelumnya:</span><span className="font-medium text-red-600">Rp {(selectedLoan.total_amount - selectedLoan.paid_amount).toLocaleString("id-ID")}</span></div>
            </div>
            <Input label="Jumlah Pembayaran (Rp)" type="number" min="1000" max={selectedLoan.total_amount - selectedLoan.paid_amount} required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsPaymentOpen(false)}>Batal</Button>
              <Button type="submit" isLoading={submitting}>Konfirmasi Pembayaran</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="Riwayat Pembayaran Kasbon">
        {selectedLoan && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
              <div className="font-semibold text-slate-800 mb-1">{selectedLoan.employees?.name}</div>
              <div className="flex justify-between"><span className="text-slate-500">Total Pinjaman:</span><span className="font-medium">Rp {selectedLoan.total_amount.toLocaleString("id-ID")}</span></div>
            </div>
            <div className="max-h-[300px] overflow-auto">
              {historyLoading ? <div className="p-4 text-center text-slate-400">Loading history...</div> : paymentHistory.length === 0 ? <div className="p-8 text-center text-slate-500 italic">Belum ada cicilan pembayaran.</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                  <TableBody>{paymentHistory.map((pay) => (
                    <TableRow key={pay.id}><TableCell className="text-sm">{format(new Date(pay.payment_date), "dd MMM yyyy")}</TableCell><TableCell className="text-right text-emerald-600 font-medium">Rp {pay.amount.toLocaleString("id-ID")}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-end"><Button onClick={() => setIsHistoryOpen(false)}>Tutup</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
