"use client";
import { Button } from "@/components/ui/button";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authService } from "@/features/auth/service/auth-service";
import { useLanguage } from "@/lib/i18n";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useLanguage();
  async function signOut() {
    await authService.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <Button variant="ghost" size="icon-sm" type="button" onClick={signOut} className="rounded-md p-2 text-slate-500 transition hover:bg-white/5 hover:text-white" aria-label={t("Sign out")}><LogOut size={16} /></Button>;
}
