"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/auth-screens";

function Entry() {
  const params = useSearchParams();
  return (
    <AuthScreen
      initialMode={params.get("mode") === "signup" ? "signup" : "signin"}
      initialRole={params.get("role") === "provider" ? "PROVIDER" : "CUSTOMER"}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Entry />
    </Suspense>
  );
}
