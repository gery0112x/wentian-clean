'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };
  return (
    <main className="p-6">
      <h1 className="text-xl mb-4">登入無極</h1>
      <button onClick={login} className="px-4 py-2 rounded border">使用 Google 登入</button>
    </main>
  );
}
