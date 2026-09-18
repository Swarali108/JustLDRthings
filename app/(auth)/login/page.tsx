import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { AuthUnavailable } from "@/components/auth/AuthUnavailable";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Without Supabase this page cannot do anything but crash. Say so instead.
  if (!hasSupabaseConfig()) return <AuthUnavailable />;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect(next || "/dashboard");

  return (
    <main className="auth-shell">
      <Link href="/" className="brand auth-brand">
        JustLDRthings <span aria-hidden>♡</span>
      </Link>
      <AuthForm mode="login" next={next} />
    </main>
  );
}
