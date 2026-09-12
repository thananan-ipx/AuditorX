import { LoginCard } from "@/features/auth/components/login-card";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; status?: string; next?: string }>;
};

export async function LoginPage({ searchParams }: LoginPageProps) {
  const { status, next = "/" } = await searchParams;

  return <LoginCard next={next} initialStatus={status} />;
}
