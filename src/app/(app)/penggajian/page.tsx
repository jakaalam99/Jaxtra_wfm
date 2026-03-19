"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calculator, Download, FileText, CheckCircle, Undo2, Loader2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

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

type PayrollData = {
  employee: any;
  hariHadir: number;
  jamLembur: number;
  gajiPokok: number; 
  totalLembur: number; 
  sisaKasbon: number; 
  potonganKasbon: number; 
  totalAkhir: number;
};

export default function PenggajianPage() {
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  
  const [payrollResult, setPayrollResult] = useState<PayrollData[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [periodStatus, setPeriodStatus] = useState<"draft" | "confirmed">("draft");
  
  const [lemburRate, setLemburRate] = useState<number>(20000);

  const calculatePayroll = async () => {
    if (!startDate || !endDate) return alert("Pilih periode tanggal terlebih dahulu");
    setLoading(true);
    setPayrollResult([]);
    setPeriodId(null);
    setPeriodStatus("draft");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // 1. Get or Create Period for this specific user
      let { data: period } = await supabase
        .from("salary_periods")
        .select("*")
        .eq("start_date", startDate)
        .eq("end_date", endDate)
        .eq("user_id", session.user.id)
        .single();

      
      if (!period) {
        const { data: newPeriod, error: pErr } = await supabase
          .from("salary_periods")
          .insert({ start_date: startDate, end_date: endDate, status: "draft" })
          .select()
          .single();
        if (pErr) throw pErr;
        period = newPeriod;
      }
      
      setPeriodId(period.id);
      setPeriodStatus(period.status as any);

      // 2. Fetch All Data
      const [
        { data: emps },
        { data: att },
        { data: loans },
        { data: adjs }
      ] = await Promise.all([
        supabase.from("employees").select("*").order("name"),
        supabase.from("attendance").select("*").gte("date", startDate).lte("date", endDate).eq("status", "Hadir"),
        supabase.from("loans").select("*"),
        supabase.from("salary_adjustments").select("*").eq("period_id", period.id)
      ]);

      const result: PayrollData[] = [];

      emps?.forEach((emp) => {
        const empAtt = att?.filter(a => a.employee_id === emp.id) || [];
        const hariHadir = empAtt.length;
        const jamLembur = empAtt.reduce((sum, a) => sum + (Number(a.overtime_hours) || 0), 0);
        
        let gajiPokokcalc = emp.salary_type === "Bulanan" ? Number(emp.base_rate) : Number(emp.base_rate) * hariHadir;
        const totalLemburCalc = jamLembur * lemburRate;

        const empLoans = loans?.filter(l => l.employee_id === emp.id) || [];
        const sisaKasbon = empLoans.reduce((sum, l) => sum + (Number(l.total_amount) - Number(l.paid_amount)), 0);

        const adj = adjs?.find(a => a.employee_id === emp.id);
        const savedPotongan = adj ? Number(adj.loan_deduction_amount) : 0;

        result.push({
          employee: emp,
          hariHadir,
          jamLembur,
          gajiPokok: gajiPokokcalc,
          totalLembur: totalLemburCalc,
          sisaKasbon: sisaKasbon + (period.status === 'confirmed' ? savedPotongan : 0),
          potonganKasbon: savedPotongan,
          totalAkhir: gajiPokokcalc + totalLemburCalc - savedPotongan
        });
      });

      setPayrollResult(result);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePotonganChange = async (empId: string, valueStr: string) => {
    if (periodStatus === "confirmed") return;
    const val = parseFloat(valueStr) || 0;
    
    setPayrollResult(prev => prev.map(p => {
      if (p.employee.id === empId) {
        const validVal = Math.min(val, p.sisaKasbon);
        return {
          ...p,
          potonganKasbon: validVal,
          totalAkhir: p.gajiPokok + p.totalLembur - validVal
        };
      }
      return p;
    }));

    // Save to adjustments silently
    if (periodId) {
      await supabase.from("salary_adjustments").upsert({
        employee_id: empId,
        period_id: periodId,
        loan_deduction_amount: val
      }, { onConflict: 'employee_id,period_id' });
    }
  };

  const confirmPayroll = async () => {
    if (!periodId || periodStatus === "confirmed") return;
    if (!confirm("Konfirmasi penggajian? Hal ini akan memotong sisa kasbon karyawan secara permanen.")) return;
    
    setProcessing(true);
    try {
      const { data: loans } = await supabase.from("loans").select("*");
      
      for (const p of payrollResult) {
        if (p.potonganKasbon > 0) {
          const empLoans = loans?.filter(l => l.employee_id === p.employee.id && (l.total_amount - l.paid_amount) > 0) || [];
          let remainingPotongan = p.potonganKasbon;

          for (const loan of empLoans) {
            if (remainingPotongan <= 0) break;
            const sisaLoan = loan.total_amount - loan.paid_amount;
            const payAmt = Math.min(remainingPotongan, sisaLoan);

            await supabase.from("loan_payments").insert({
              loan_id: loan.id,
              period_id: periodId,
              amount: payAmt,
              payment_date: endDate
            });

            await supabase.from("loans")
              .update({ paid_amount: loan.paid_amount + payAmt })
              .eq("id", loan.id);
            
            remainingPotongan -= payAmt;
          }
        }
      }

      await supabase.from("salary_periods")
        .update({ status: "confirmed" })
        .eq("id", periodId);

      setPeriodStatus("confirmed");
      alert("Penggajian berhasil dikonfirmasi!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const undoPayroll = async () => {
    if (!periodId || periodStatus === "draft") return;
    if (!confirm("Batalkan konfirmasi? Hal ini akan mengembalikan sisa kasbon karyawan.")) return;

    setProcessing(true);
    try {
      const { data: payments } = await supabase
        .from("loan_payments")
        .select("*")
        .eq("period_id", periodId);

      if (payments) {
        for (const pay of payments) {
          const { data: loan } = await supabase.from("loans").select("paid_amount").eq("id", pay.loan_id).single();
          if (loan) {
            await supabase.from("loans")
              .update({ paid_amount: Math.max(0, loan.paid_amount - pay.amount) })
              .eq("id", pay.loan_id);
          }
        }
        await supabase.from("loan_payments").delete().eq("period_id", periodId);
      }

      await supabase.from("salary_periods")
        .update({ status: "draft" })
        .eq("id", periodId);

      setPeriodStatus("draft");
      alert("Konfirmasi penggajian berhasil dibatalkan!");
      calculatePayroll();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const grandTotal = payrollResult.reduce((sum, p) => sum + p.totalAkhir, 0);

  const exportExcel = () => {
    if (payrollResult.length === 0) return;
    const wsData = payrollResult.map((p) => ({
      "Nama Karyawan": p.employee.name,
      "Tipe": p.employee.salary_type,
      "Hadir (Hari)": p.hariHadir,
      "Lembur (Jam)": p.jamLembur,
      "Gaji Pokok": p.gajiPokok,
      "Total Lembur": p.totalLembur,
      "Sisa Kasbon": p.sisaKasbon,
      "Potongan Kasbon": p.potonganKasbon,
      "Total Akhir (Take Home Pay)": p.totalAkhir
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Gaji");
    XLSX.writeFile(wb, `Rekap_Gaji_${startDate}_sd_${endDate}.xlsx`);
  };

  const exportPDFSlips = async (singleEmployeeId?: string) => {
    let dataToExport = payrollResult;
    if (singleEmployeeId) dataToExport = payrollResult.filter(p => p.employee.id === singleEmployeeId);
    if (dataToExport.length === 0) return;

    // Fetch PDF Branding
    const { data: settings } = await supabase.from('app_settings')
      .select('pdf_logo_url, pdf_logo_width')
      .eq('id', 'global')
      .single();

    const loadLogo = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = url;
      });
    };

    let logoData: string | null = null;
    if (settings?.pdf_logo_url) {
      try {
        logoData = await loadLogo(settings.pdf_logo_url);
      } catch (e) {
        console.error("Failed to load PDF logo", e);
      }
    }

    const doc = new jsPDF("p", "mm", "a4");
    for (let index = 0; index < dataToExport.length; index++) {
      const p = dataToExport[index];
      if (index > 0) doc.addPage();
      
      // Branding Logo (Top Left)
      if (logoData) {
        const logoWidth = settings?.pdf_logo_width || 50;
        doc.addImage(logoData, "PNG", 20, 10, logoWidth, 0); // height auto
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("SLIP GAJI", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 105, 28, { align: "center" });
      doc.line(20, 32, 190, 32);
      doc.text(`Nama: ${p.employee.name}`, 20, 40);
      doc.text(`Posisi: ${p.employee.position}`, 20, 46);
      doc.text(`Tipe Gaji: ${p.employee.salary_type}`, 140, 40);
      doc.setFont("helvetica", "bold");
      doc.text("PENERIMAAN", 20, 60);
      doc.text("POTONGAN", 120, 60);
      doc.setFont("helvetica", "normal");
      doc.text("Gaji Pokok", 20, 70);
      doc.text(`Rp ${p.gajiPokok.toLocaleString("id-ID")}`, 80, 70, { align: "right" });
      doc.text(`Lembur (${p.jamLembur} Jam)`, 20, 76);
      doc.text(`Rp ${p.totalLembur.toLocaleString("id-ID")}`, 80, 76, { align: "right" });
      doc.text("Kasbon/Pinjaman", 120, 70);
      doc.text(`Rp ${p.potonganKasbon.toLocaleString("id-ID")}`, 180, 70, { align: "right" });
      const totalPenerimaan = p.gajiPokok + p.totalLembur;
      doc.line(20, 82, 80, 82);
      doc.setFont("helvetica", "bold");
      doc.text("Total", 20, 88);
      doc.text(`Rp ${totalPenerimaan.toLocaleString("id-ID")}`, 80, 88, { align: "right" });
      doc.line(120, 82, 180, 82);
      doc.text("Total", 120, 88);
      doc.text(`Rp ${p.potonganKasbon.toLocaleString("id-ID")}`, 180, 88, { align: "right" });
      doc.line(20, 100, 190, 100);
      doc.setFontSize(12);
      doc.text("TOTAL TAKE HOME PAY", 20, 110);
      doc.text(`Rp ${p.totalAkhir.toLocaleString("id-ID")}`, 190, 110, { align: "right" });
      
      const remainingLoan = p.sisaKasbon - p.potonganKasbon;
      if (remainingLoan > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 0, 0); // Subtle red
        doc.text(`Sisa Kasbon Setelah Potongan: Rp ${remainingLoan.toLocaleString("id-ID")}`, 190, 116, { align: "right" });
        doc.setTextColor(0, 0, 0); // Reset
      }
      
      doc.setFontSize(10);

      doc.setFont("helvetica", "normal");
      doc.text("Penerima,", 40, 130, { align: "center" });
      doc.text("(...........................)", 40, 155, { align: "center" });
      doc.text("Pemberi,", 160, 130, { align: "center" });
      doc.text("(...........................)", 160, 155, { align: "center" });
    }
    const fileName = singleEmployeeId ? `Slip_Gaji_${dataToExport[0].employee.name.replace(/\s+/g, '_')}.pdf` : `Slip_Gaji_Massal.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Perhitungan Gaji</h2>
          <p className="text-slate-500 text-sm mt-1">Hitung, konfirmasi, dan cetak rekap gaji karyawan.</p>
        </div>
      </div>

      <div className="glass-panel p-6 flex flex-col md:flex-row items-end gap-4 bg-slate-50 border-[var(--color-primary-100)]">
        <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
          <Input label="Tanggal Mulai" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Tanggal Selesai" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Input label="Tarif Lembur (Rp/Jam)" type="number" value={lemburRate} onChange={(e) => setLemburRate(Number(e.target.value))} />
        </div>
        <Button onClick={calculatePayroll} isLoading={loading} className="w-full sm:w-auto mt-4 sm:mt-0 gap-2">
          <Calculator className="w-4 h-4" /> Hitung Gaji
        </Button>
      </div>

      {payrollResult.length > 0 && (
        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-700">Hasil Rekap: {startDate} s/d {endDate}</h3>
              {periodStatus === 'confirmed' ? (
                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium">
                  <CheckCircle className="w-3 h-3" /> Terkonfirmasi
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium">
                  <AlertCircle className="w-3 h-3" /> Preview (Draft)
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              {periodStatus === 'draft' ? (
                <Button onClick={confirmPayroll} isLoading={processing} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="w-4 h-4" /> Konfirmasi Penggajian
                </Button>
              ) : (
                <>
                  <Button onClick={exportExcel} variant="secondary" className="gap-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50">
                    <FileText className="w-4 h-4" /> Excel
                  </Button>
                  <Button 
                    onClick={async () => {
                      setExportingPdf(true);
                      await exportPDFSlips();
                      setExportingPdf(false);
                    }} 
                    variant="secondary" 
                    isLoading={exportingPdf}
                    className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50"
                  >
                    <Download className="w-4 h-4" /> PDF Massal
                  </Button>
                  <Button onClick={undoPayroll} isLoading={processing} variant="ghost" className="gap-2 text-slate-500 hover:text-red-600">
                    <Undo2 className="w-4 h-4" /> Undo Konfirmasi
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-center">Kehadiran</TableHead>
                  <TableHead className="text-right">Gaji Pokok</TableHead>
                  <TableHead className="text-right">Lembur</TableHead>
                  <TableHead className="text-right w-48">Potongan Kasbon</TableHead>
                  <TableHead className="text-right">Total Gaji</TableHead>
                  {periodStatus === 'confirmed' && <TableHead className="text-center w-[100px]">Slip</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollResult.map((p) => (
                  <TableRow key={p.employee.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{p.employee.name}</div>
                      <div className="text-xs text-slate-500">{p.employee.salary_type}</div>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {p.hariHadir} Hari {p.jamLembur > 0 && <span className="text-emerald-600 font-medium">(+{p.jamLembur}h)</span>}
                    </TableCell>
                    <TableCell className="text-right text-emerald-700 font-bold whitespace-nowrap bg-emerald-50/20">Rp {p.gajiPokok.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right text-emerald-700 font-bold whitespace-nowrap bg-emerald-50/20">Rp {p.totalLembur.toLocaleString("id-ID")}</TableCell>


                    <TableCell className="text-right bg-red-50/30">
                      <div className="flex flex-col items-end gap-1">
                        {p.sisaKasbon > 0 && <span className="text-[10px] text-red-600 font-bold uppercase tracking-tight">Tersedia: Rp {p.sisaKasbon.toLocaleString("id-ID")}</span>}
                        <Input
                          type="number"
                          value={p.potonganKasbon || ""}
                          onChange={(e) => handlePotonganChange(p.employee.id, e.target.value)}
                          disabled={periodStatus === 'confirmed' || p.sisaKasbon === 0}
                          className={`w-full text-right h-8 ${p.potonganKasbon > 0 ? "text-red-700 font-bold border-red-300 ring-1 ring-red-100" : ""}`}
                          placeholder="0"
                        />
                      </div>
                    </TableCell>


                    <TableCell className="text-right font-semibold text-slate-900 bg-[var(--color-primary-50)] whitespace-nowrap">
                      Rp {p.totalAkhir.toLocaleString("id-ID")}
                    </TableCell>
                    {periodStatus === 'confirmed' && (
                      <TableCell className="text-center">
                        <Button 
                          variant="secondary"
                          onClick={() => exportPDFSlips(p.employee.id)} 
                          className="h-8 px-3 flex items-center gap-2 bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-400 shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-xs font-bold uppercase tracking-tight text-blue-600">Slip</span>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card-based View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {payrollResult.map((p) => (
              <div key={p.employee.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 leading-tight">{p.employee.name}</h4>
                    <p className="text-xs text-slate-500">{p.employee.position} • {p.employee.salary_type}</p>
                  </div>
                  {periodStatus === 'confirmed' && (
                    <Button 
                      variant="secondary"
                      onClick={() => exportPDFSlips(p.employee.id)} 
                      className="h-8 px-3 flex items-center gap-1.5 bg-white border-blue-200 text-blue-600 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                    >
                      <Download className="w-4 h-4 shrink-0" /> <span className="ml-1">Slip</span>

                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block mb-0.5 uppercase font-bold text-[9px] tracking-wider">Kehadiran</span>
                    <span className="font-bold text-emerald-600">{p.hariHadir} Hari {p.jamLembur > 0 && <span className="text-emerald-500">(+{p.jamLembur}h)</span>}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg text-right">
                    <span className="text-slate-400 block mb-0.5 uppercase font-bold text-[9px] tracking-wider">Lembur</span>
                    <span className="font-bold text-emerald-600">Rp {p.totalLembur.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block mb-0.5 uppercase font-bold text-[9px] tracking-wider">Gaji Pokok</span>
                    <span className="font-bold text-emerald-600">Rp {p.gajiPokok.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="p-2 bg-[var(--color-primary-50)] rounded-lg text-right border border-[var(--color-primary-100)]">
                    <span className="text-[var(--color-primary-400)] block mb-0.5 font-bold uppercase text-[9px] tracking-wider">Total Gaji</span>
                    <span className="font-exrabold text-[var(--color-primary-700)] text-sm">Rp {p.totalAkhir.toLocaleString("id-ID")}</span>
                  </div>
                </div>


                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Status Pinjaman</span>
                    {p.sisaKasbon > 0 && <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Tersedia: Rp {p.sisaKasbon.toLocaleString("id-ID")}</span>}
                  </div>
                  
                  {periodStatus === 'draft' ? (
                    <Input
                      type="number"
                      value={p.potonganKasbon || ""}
                      onChange={(e) => handlePotonganChange(p.employee.id, e.target.value)}
                      disabled={p.sisaKasbon === 0}
                      className={`w-full text-right h-9 text-sm ${p.potonganKasbon > 0 ? "border-red-200 text-red-600 font-bold" : ""}`}
                      placeholder="Potongan kasbon..."
                    />
                  ) : (
                    <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-[10px] text-red-400 font-bold uppercase">Potongan:</span>
                      <span className="text-xs font-bold text-red-700">Rp {p.potonganKasbon.toLocaleString("id-ID")}</span>
                    </div>
                  )}

                  {(p.sisaKasbon - p.potonganKasbon) > 0 && (
                    <div className="flex justify-between items-center px-2 py-1">
                      <span className="text-[10px] text-slate-400 italic">Sisa setelah gaji:</span>
                      <span className="text-[11px] font-semibold text-slate-600">Rp {(p.sisaKasbon - p.potonganKasbon).toLocaleString("id-ID")}</span>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
          
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
            <div>
              <span className="text-slate-400 text-sm block">Total Pengeluaran Gaji</span>
              <span className="text-xs text-slate-500 uppercase tracking-widest">{payrollResult.length} Karyawan</span>
            </div>
            <div className="text-2xl font-bold">
              Rp {grandTotal.toLocaleString("id-ID")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
