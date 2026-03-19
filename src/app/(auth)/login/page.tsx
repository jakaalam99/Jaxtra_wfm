"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logo, setLogo] = useState<{ url: string | null; width: number }>({ url: null, width: 200 });

  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = await supabase.from('app_settings')
        .select('login_logo_url, login_logo_width')
        .eq('id', 'global')
        .maybeSingle();
      if (data) {
        setLogo({ url: data.login_logo_url, width: data.login_logo_width || 200 });
      }
    };
    fetchLogo();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("user not found") || error.message.toLowerCase().includes("not found")) {
        setError("User tidak ditemukan");
      } else if (error.message.toLowerCase().includes("invalid login credentials")) {
        setError("Email atau Password salah");
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else if (data.user) {
      // 1. Ensure profile exists
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        last_action_at: new Date().toISOString()
      }, { onConflict: 'id' });

      // 2. Fetch role specifically
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      
      if (profileErr) {
        console.error("Profile Fetch Error:", profileErr.message, profileErr.details, profileErr.hint);
      }
      
      console.log("Login Outcome -> User ID:", data.user.id, "Role:", profile?.role);

      if (profile?.role?.toLowerCase() === 'admin') {
        router.push("/admin");
      } else {
        router.push("/");
      }
      
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative background elements */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-[var(--color-primary-100)] rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md z-10 space-y-8 animate-fade-in-up">
        {/* Logo/Branding Header */}
        <div className="text-center group">
          {logo.url ? (
            <div className="inline-block p-4 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm transition-all duration-500 group-hover:shadow-md group-hover:scale-105">
              <img 
                src={logo.url} 
                alt="Company Logo" 
                style={{ width: `${logo.width}px` }} 
                className="object-contain" 
              />
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter transition-all hover:tracking-normal duration-500">
                Jaxtra<span className="text-[var(--color-primary-500)]">.</span>
              </h2>
              <p className="text-slate-500 font-medium tracking-wide uppercase text-[10px]">
                Workforce Management System
              </p>
            </div>
          )}
        </div>

        {/* Login Card */}
        <div className="bg-white/70 backdrop-blur-xl py-10 px-8 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] border border-white/60 relative overflow-hidden">
          {/* Subtle top glare */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
          
          <div className="relative">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
              <p className="text-slate-500 text-sm mt-1">Please enter your details to sign in.</p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <div className="space-y-1">
                <Input
                  label="Email Address"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Password"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                />
              </div>

              {error && (
                <div className="text-xs font-medium border border-red-100 bg-red-50/50 text-red-600 p-3 rounded-xl flex items-center gap-2 animate-shake">
                  <div className="w-1 h-4 bg-red-400 rounded-full"></div>
                  {error}
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-bold shadow-lg shadow-[var(--color-primary-100)] rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]" 
                  isLoading={loading}
                >
                  Sign In
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-slate-400 text-xs">
          © {new Date().getFullYear()} Jaxtra Technologies
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
