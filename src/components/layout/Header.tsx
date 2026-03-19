import { Menu } from "lucide-react";

export function Header({ 
  title, 
  logoUrl, 
  logoWidth = 150, 
  onMenuClick 
}: { 
  title: string; 
  logoUrl?: string | null; 
  logoWidth?: number;
  onMenuClick: () => void 
}) {
  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 sm:px-8 shrink-0">
      <button onClick={onMenuClick} className="mr-4 lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md">
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-4 flex-1">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" style={{ width: `${logoWidth}px` }} className="object-contain" />
        ) : (
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{title}</h2>
        )}
      </div>
    </header>
  );
}
