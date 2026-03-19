"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UploadCloud, CheckCircle, Trash2, Layout, Image as ImageIcon, FileText } from "lucide-react";

type Profile = {
  id: string;
  email: string;
  role: string;
  last_action_at: string | null;
  created_at: string;
};

type AppSettings = {
  id: string;
  company_name: string;
  login_logo_url: string | null;
  login_logo_width: number;
  header_logo_url: string | null;
  header_logo_width: number;
  pdf_logo_url: string | null;
  pdf_logo_width: number;
};

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);

  useEffect(() => {
    initAdmin();
  }, []);

  const initAdmin = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    if (profile?.role?.toLowerCase() !== "admin") {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const { data: users } = await supabase.from("profiles").select("*").order("last_action_at", { ascending: false, nullsFirst: false });
    
    // Fetch or Create global settings
    let { data: appSettings, error: sErr } = await supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
    if (!appSettings) {
      const { data: newSettings } = await supabase.from("app_settings").upsert({ id: "global", company_name: "Jaxtra" }).select().maybeSingle();
      appSettings = newSettings;
    }

    if (users) setProfiles(users);
    if (appSettings) setSettings(appSettings);
    setLoading(false);
  };

  const handleUpload = async (category: 'login' | 'header' | 'pdf', file: File) => {
    if (!settings) return;
    setUploadingCategory(category);
    try {
      // 1. Delete old file if exists
      const oldUrl = settings[`${category}_logo_url` as keyof AppSettings] as string;
      if (oldUrl) {
        const path = oldUrl.split('/').pop();
        if (path) await supabase.storage.from('assets').remove([path]);
      }

      // 2. Upload new file
      const fileExt = file.name.split('.').pop();
      const fileName = `${category}-logo-${Math.random()}.${fileExt}`;
      const { error: upErr } = await supabase.storage.from('assets').upload(fileName, file);
      if (upErr) throw upErr;

      // 3. Update DB (Use upsert to ensure row exists)
      const { data: pubData } = supabase.storage.from('assets').getPublicUrl(fileName);
      await supabase.from('app_settings').upsert({
        id: 'global',
        [`${category}_logo_url`]: pubData.publicUrl
      });

      await initAdmin(); // Refresh
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleDelete = async (category: 'login' | 'header' | 'pdf') => {
    if (!settings || !confirm("Hapus logo ini?")) return;
    try {
      const oldUrl = settings[`${category}_logo_url` as keyof AppSettings] as string;
      if (oldUrl) {
        const path = oldUrl.split('/').pop();
        if (path) await supabase.storage.from('assets').remove([path]);
      }
      await supabase.from('app_settings').upsert({
        id: 'global',
        [`${category}_logo_url`]: null
      });
      await initAdmin();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const updateWidth = async (category: 'login' | 'header' | 'pdf', width: number) => {
    if (!settings) return;
    try {
      await supabase.from('app_settings').upsert({
        id: 'global',
        [`${category}_logo_width`]: width
      });
      setSettings({ ...settings, [`${category}_logo_width`]: width });
    } catch (err: any) {
      alert("Update width failed: " + err.message);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading admin portal...</div>;
  if (isAdmin === false) return <div className="p-8 text-red-500">Unauthorized: You do not have admin access.</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BrandingCard 
          title="Login Page" 
          description="Logo yang muncul di layar masuk utama."
          icon={<Layout className="w-5 h-5" />}
          logoUrl={settings?.login_logo_url}
          width={settings?.login_logo_width || 200}
          onUpload={(f) => handleUpload('login', f)}
          onDelete={() => handleDelete('login')}
          onWidthChange={(w) => updateWidth('login', w)}
          isLoading={uploadingCategory === 'login'}
        />
        <BrandingCard 
          title="Dashboard Header" 
          description="Logo yang muncul di navigasi atas aplikasi."
          icon={<ImageIcon className="w-5 h-5" />}
          logoUrl={settings?.header_logo_url}
          width={settings?.header_logo_width || 150}
          onUpload={(f) => handleUpload('header', f)}
          onDelete={() => handleDelete('header')}
          onWidthChange={(w) => updateWidth('header', w)}
          isLoading={uploadingCategory === 'header'}
        />
        <BrandingCard 
          title="PDF Slip Gaji" 
          description="Logo yang muncul pada ekspor PDF slip gaji."
          icon={<FileText className="w-5 h-5" />}
          logoUrl={settings?.pdf_logo_url}
          width={settings?.pdf_logo_width || 50}
          onUpload={(f) => handleUpload('pdf', f)}
          onDelete={() => handleDelete('pdf')}
          onWidthChange={(w) => updateWidth('pdf', w)}
          isLoading={uploadingCategory === 'pdf'}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">User Activity Analysis</h3>
          <p className="text-sm text-slate-500">Overview of all registered users and their last activity.</p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email Address</TableHead>
                <TableHead>System Role</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.email}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${p.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{p.role}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {p.last_action_at ? format(new Date(p.last_action_at), "dd MMM yyyy, HH:mm") : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {format(new Date(p.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function BrandingCard({ title, description, icon, logoUrl, width, onUpload, onDelete, onWidthChange, isLoading }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  logoUrl: string | null | undefined;
  width: number;
  onUpload: (file: File) => void;
  onDelete: () => void;
  onWidthChange: (width: number) => void;
  isLoading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-slate-50 rounded-lg text-slate-600">{icon}</div>
        <div>
          <h3 className="font-bold text-slate-800">{title}</h3>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{description}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 mb-4 min-h-[160px]">
        {logoUrl ? (
          <div className="relative group">
            <img src={logoUrl} style={{ width: `${width}px` }} className="max-h-24 object-contain" alt={title} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
              <Button variant="ghost" onClick={onDelete} className="text-white hover:text-red-400 h-8 px-2">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="p-3 bg-white rounded-full inline-block shadow-sm mb-2"><UploadCloud className="w-6 h-6 text-slate-300" /></div>
            <p className="text-xs text-slate-400">Belum ada logo</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input 
            type="number" 
            label="Width (px)" 
            value={width} 
            onChange={(e) => onWidthChange(Number(e.target.value))} 
            className="flex-1"
          />
          <Button 
            className="mt-6 gap-2 h-9" 
            onClick={() => fileRef.current?.click()}
            isLoading={isLoading}
          >
            <UploadCloud className="w-4 h-4" /> Change
          </Button>
        </div>
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }} />
      </div>
    </div>
  );
}
