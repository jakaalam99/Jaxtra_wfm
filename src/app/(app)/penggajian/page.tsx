"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calculator, Download, FileText, Loader2 } from "lucide-react";
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
  gajiPokok: number; // calculated base
  totalLembur: number; // calculated over time
  sisaKasbon: number; // active outstanding loan sum
  potonganKasbon: number; // user custom input
  totalAkhir: number;
};

export default function PenggajianPage() {
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  
  const [payrollResult, setPayrollResult] = useState<PayrollData[]>([]);
  
  // Rate Lembur Configurable
  const [lemburRate, setLemburRate] = useState<number>(20000);

  const calculatePayroll = async () => {
    if (!startDate || !endDate) return alert("Pilih periode tanggal terlebih dahulu");
    setLoading(true);

    try {
      // 1. Fetch All Employees
      const { data: emps, error: empErr } = await supabase.from("employees").select("*").order("name");
      if (empErr) throw empErr;

      // 2. Fetch Attendance
      const { data: att, error: attErr } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("status", "Hadir");
      if (attErr) throw attErr;

      // 3. Fetch Active Loans for calculations (total_amount - paid_amount)
      const { data: loans, error: loanErr } = await supabase.from("loans").select("*");
      if (loanErr) throw loanErr;

      const result: PayrollData[] = [];

      emps?.forEach((emp) => {
        const empAtt = att?.filter(a => a.employee_id === emp.id) || [];
        const hariHadir = empAtt.length;
        const jamLembur = empAtt.reduce((sum, a) => sum + (Number(a.overtime_hours) || 0), 0);
        
        // Base Salary
        let gajiPokokcalc = 0;
        if (emp.salary_type === "Bulanan") {
          gajiPokokcalc = Number(emp.base_rate);
        } else {
          gajiPokokcalc = Number(emp.base_rate) * hariHadir;
        }

        const totalLemburCalc = jamLembur * lemburRate;

        // Active Loans
        const empLoans = loans?.filter(l => l.employee_id === emp.id) || [];
        const sisaKasbon = empLoans.reduce((sum, l) => sum + (Number(l.total_amount) - Number(l.paid_amount)), 0);

        result.push({
          employee: emp,
          hariHadir,
          jamLembur,
          gajiPokok: gajiPokokcalc,
          totalLembur: totalLemburCalc,
          sisaKasbon: sisaKasbon,
          potonganKasbon: 0, // Default 0, can be edited
          totalAkhir: gajiPokokcalc + totalLemburCalc - 0
        });
      });

      setPayrollResult(result);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePotonganChange = (empId: string, valueStr: string) => {
    const val = parseFloat(valueStr) || 0;
    setPayrollResult(prev => prev.map(p => {
      if (p.employee.id === empId) {
        // limit deduction to maximum sisa
        const validVal = Math.min(val, p.sisaKasbon);
        return {
          ...p,
          potonganKasbon: validVal,
          totalAkhir: p.gajiPokok + p.totalLembur - validVal
        };
      }
      return p;
    }));
  };

  // EXPORT EXCEL
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

  // EXPORT PDF PINGGAJIAN (Batched or Single)
  const exportPDFSlips = (singleEmployeeId?: string) => {
    let dataToExport = payrollResult;
    
    // Filter to a single employee if an ID is provided
    if (singleEmployeeId) {
      dataToExport = payrollResult.filter(p => p.employee.id === singleEmployeeId);
    }

    if (dataToExport.length === 0) return;

    const doc = new jsPDF("p", "mm", "a4");
    
    dataToExport.forEach((p, index) => {
      if (index > 0) doc.addPage();
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("JAXTRA", 105, 20, { align: "center" });
      
      doc.setFontSize(14);
      doc.text("SLIP GAJI", 105, 30, { align: "center" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 105, 38, { align: "center" });
      
      doc.line(20, 42, 190, 42); // Header line

      // Employee Info
      doc.text(`Nama: ${p.employee.name}`, 20, 50);
      doc.text(`Posisi: ${p.employee.position}`, 20, 56);
      doc.text(`Tipe Gaji: ${p.employee.salary_type}`, 140, 50);

      // Tables mapping
      doc.setFont("helvetica", "bold");
      doc.text("PENERIMAAN", 20, 70);
      doc.text("POTONGAN", 120, 70);
      doc.setFont("helvetica", "normal");

      // Penerimaan Details
      doc.text("Gaji Pokok", 20, 80);
      doc.text(`Rp ${p.gajiPokok.toLocaleString("id-ID")}`, 80, 80, { align: "right" });
      
      doc.text(`Lembur (${p.jamLembur} Jam)`, 20, 86);
      doc.text(`Rp ${p.totalLembur.toLocaleString("id-ID")}`, 80, 86, { align: "right" });

      // Potongan Details
      doc.text("Kasbon/Pinjaman", 120, 80);
      doc.text(`Rp ${p.potonganKasbon.toLocaleString("id-ID")}`, 180, 80, { align: "right" });

      // Total Penerimaan vs Total Potongan
      const totalPenerimaan = p.gajiPokok + p.totalLembur;
      
      doc.line(20, 92, 80, 92);
      doc.setFont("helvetica", "bold");
      doc.text("Total", 20, 98);
      doc.text(`Rp ${totalPenerimaan.toLocaleString("id-ID")}`, 80, 98, { align: "right" });

      doc.line(120, 92, 180, 92);
      doc.text("Total", 120, 98);
      doc.text(`Rp ${p.potonganKasbon.toLocaleString("id-ID")}`, 180, 98, { align: "right" });

      // Take home pay
      doc.line(20, 110, 190, 110);
      doc.setFontSize(12);
      doc.text("TOTAL TAKE HOME PAY", 20, 120);
      doc.text(`Rp ${p.totalAkhir.toLocaleString("id-ID")}`, 190, 120, { align: "right" });
      
      // Signatures
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Penerima,", 40, 140, { align: "center" });
      doc.text("(...........................)", 40, 165, { align: "center" });

      doc.text("Manajemen JAXTRA,", 160, 140, { align: "center" });
      doc.text("(...........................)", 160, 165, { align: "center" });
    });

    const fileName = singleEmployeeId 
      ? `Slip_Gaji_${dataToExport[0].employee.name.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf` 
      : `Slip_Gaji_Massal_${startDate}_${endDate}.pdf`;
      
    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Perhitungan Gaji</h2>
          <p className="text-slate-500 text-sm mt-1">Hitung dan cetak rekap gaji beserta slip gaji karyawan.</p>
        </div>
      </div>

      <div className="glass-panel p-6 flex flex-col md:flex-row items-end gap-4 bg-slate-50 border-[var(--color-primary-100)]">
        <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
          <Input
            label="Tanggal Mulai"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Tanggal Selesai"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Input
            label="Tarif Lembur (Rp/Jam)"
            type="number"
            min="0"
            value={lemburRate}
            onChange={(e) => setLemburRate(Number(e.target.value))}
          />
        </div>
        <Button onClick={calculatePayroll} isLoading={loading} className="w-full sm:w-auto mt-4 sm:mt-0 gap-2">
          <Calculator className="w-4 h-4" />
          Hitung Gaji
        </Button>
      </div>

      {payrollResult.length > 0 && (
        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Hasil Rekap Periode: {startDate} s/d {endDate}</h3>
            <div className="flex gap-2">
              <Button onClick={exportExcel} variant="secondary" className="gap-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50">
                <FileText className="w-4 h-4" />
                Cetak Excel
              </Button>
              <Button onClick={() => exportPDFSlips()} variant="secondary" className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50">
                <Download className="w-4 h-4" />
                Slip PDF Massal
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-center">Kehadiran</TableHead>
                  <TableHead className="text-right">Gaji Pokok</TableHead>
                  <TableHead className="text-right">Lembur</TableHead>
                  <TableHead className="text-right w-40">Potongan Kasbon</TableHead>
                  <TableHead className="text-right"><strong>Total Gaji</strong></TableHead>
                  <TableHead className="text-center w-[120px]">Slip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollResult.map((p) => (
                  <TableRow key={p.employee.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{p.employee.name}</div>
                      <div className="text-xs text-slate-500">{p.employee.salary_type}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">{p.hariHadir} Hari</div>
                      {p.jamLembur > 0 && <span className="text-xs text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-1 py-0.5 rounded">+{p.jamLembur} Jam</span>}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">Rp {p.gajiPokok.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right text-slate-600">Rp {p.totalLembur.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right bg-slate-50/50">
                      <div className="flex flex-col items-end gap-1">
                        {p.sisaKasbon > 0 && <span className="text-xs text-red-500">Sisa: Rp {p.sisaKasbon.toLocaleString("id-ID")}</span>}
                        <Input
                          type="number"
                          min="0"
                          max={p.sisaKasbon}
                          value={p.potonganKasbon || ""}
                          onChange={(e) => handlePotonganChange(p.employee.id, e.target.value)}
                          disabled={p.sisaKasbon === 0}
                          className="w-full text-right h-8"
                          placeholder="0"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-lg text-slate-900 bg-[var(--color-primary-50)]">
                      Rp {p.totalAkhir.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="secondary"
                        onClick={() => exportPDFSlips(p.employee.id)}
                        className="h-8 px-2 py-1 text-xs gap-1"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
