"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthModalStore } from "@/store/authModalStore";

export function RegisterModalRedirect() {
  const router = useRouter();
  const openRegister = useAuthModalStore((s) => s.openRegister);

  useEffect(() => {
    openRegister("/account");
    router.replace("/");
  }, [openRegister, router]);

  return null;
}
