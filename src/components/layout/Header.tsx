export function Header({ title }: { title: string }) {
  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center px-8 shrink-0">
      <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{title}</h2>
    </header>
  );
}
