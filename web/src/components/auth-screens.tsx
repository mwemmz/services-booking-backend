"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, uploadImage } from "@/lib/client";
import { confirmPassword as passwordsMatch, emailAddress, imageFileProblem, passwordValue, personName, phoneLocal, resetCode } from "@/lib/validate";
import { Gate, useFormGate } from "./form-gate";
import { BackLink, Banner, Button, Field, PasswordField, PhoneField, TextInput } from "./ui";

type Mode = "signin" | "signup";
type SignupRole = "CUSTOMER" | "PROVIDER";

/**
 * The only auth screen. Signing in asks for nothing but a phone number or email
 * and a password; the account's stored role decides which side of the app opens.
 * Creating an account asks for three fields and one choice, then lands inside
 * the app, so nobody has to pick a role in order to log in or move through
 * separate start, login and register pages.
 */
export function AuthScreen({ initialMode = "signin", initialRole = "CUSTOMER" }: { initialMode?: Mode; initialRole?: SignupRole }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const identifierProblem = () => {
    const text = identifier.trim();
    if (!text) return "Enter your phone number or email.";
    if (text.includes("@")) return emailAddress(text);
    return phoneLocal(text.replace(/\D/g, "").replace(/^260/, ""));
  };
  const signinGate = useFormGate([
    { id: "identifier", message: identifierProblem() },
    { id: "password", message: passwordValue(password) },
  ]);
  const signupGate = useFormGate([
    { id: "name", message: personName(fullName) },
    { id: "phone", message: phoneLocal(phone) },
    { id: "password", message: passwordValue(password) },
  ]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const gate = mode === "signin" ? signinGate : signupGate;
    if (gate.blockSubmit()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ home: string }>(
        mode === "signin" ? "/api/session/login" : "/api/session/signup",
        {
          method: "POST",
          body: JSON.stringify(mode === "signin" ? { identifier: identifier.trim(), password } : { role, fullName, phone, password }),
        },
      );
      router.replace(result.home);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : mode === "signin" ? "Login failed" : "Unable to create your account.");
      setLoading(false);
    }
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => { setMode(value); setError(""); }}
      className={`h-11 flex-1 rounded-full text-sm font-semibold transition ${mode === value ? "bg-forest text-white" : "text-[#4a3120]"}`}
    >
      {label}
    </button>
  );
  const choice = (value: SignupRole, title: string, hint: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      aria-pressed={role === value}
      className={`flex-1 rounded-[18px] border px-3 py-2.5 text-left transition ${role === value ? "border-forest bg-forest/10 ring-2 ring-forest/20" : "border-line bg-card"}`}
    >
      <span className="block text-sm font-semibold text-[#3a2a22]">{title}</span>
      <span className="block text-[11px] leading-tight text-muted">{hint}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-cream">
      <div className="relative min-h-[210px] flex-1 overflow-hidden bg-[#3a2418]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/welcome.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_15%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
        <div className="relative flex h-full flex-col justify-end px-6 pb-9 pt-24">
          <h1 className="font-display text-[1.75rem] leading-[1.08] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">Skilled work when you need it</h1>
          <p className="mt-1.5 text-sm text-white/90">Book beauty, handy work and cleaning from people near you.</p>
        </div>
      </div>
      <div className="relative -mt-6 shrink-0 rounded-t-[30px] bg-cream px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.2)]">
          <div className="flex gap-1 rounded-full bg-sand p-1">{tab("signin", "Sign in")}{tab("signup", "Create account")}</div>
          <form onSubmit={submit} className="mt-4 space-y-3.5" noValidate>
            {error && <Banner>{error}</Banner>}
            {mode === "signin" ? (
              <>
                <Gate id="identifier" gate={signinGate}>
                  <Field label="Phone number or email" error={signinGate.error("identifier")}>
                    <TextInput value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="097 1234567 or you@example.com" {...signinGate.input("identifier")} />
                  </Field>
                </Gate>
                <Gate id="password" gate={signinGate}>
                  <Field label="Password" error={signinGate.error("password")}>
                    <PasswordField value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="Password" {...signinGate.input("password")} />
                  </Field>
                </Gate>
                <div className="text-right"><Link href="/customer/forgot" className="link-blue text-sm font-semibold">Forgot password?</Link></div>
                <Button type="submit" loading={loading}>Log in</Button>
              </>
            ) : (
              <>
                <div className="flex gap-2">{choice("CUSTOMER", "I need a service", "Find and book providers")}{choice("PROVIDER", "I offer a service", "Get booking requests")}</div>
                <Gate id="name" gate={signupGate}>
                  <Field label="Full name" error={signupGate.error("name")}>
                    <TextInput value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Your full name" {...signupGate.input("name")} />
                  </Field>
                </Gate>
                <Gate id="phone" gate={signupGate}>
                  <Field label="Phone number" error={signupGate.error("phone")}>
                    <PhoneField value={phone} onChange={setPhone} {...signupGate.input("phone")} />
                  </Field>
                </Gate>
                <Gate id="password" gate={signupGate}>
                  <Field label="Password" error={signupGate.error("password")}>
                    <PasswordField value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" {...signupGate.input("password")} />
                  </Field>
                </Gate>
                <Button type="submit" loading={loading}>{role === "PROVIDER" ? "Create provider account" : "Create account"}</Button>
              </>
            )}
          </form>
      </div>
    </div>
  );
}

export function ForgotScreen() {
  const loginHref = "/";
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const phoneGate = useFormGate([{ id: "phone", message: phoneLocal(phone) }]);
  const resetGate = useFormGate([
    { id: "code", message: resetCode(code) },
    { id: "password", message: passwordValue(password) },
  ]);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (phoneGate.blockSubmit()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ message: string; devCode?: string }>("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setMessage(result.message);
      setDevCode(result.devCode ?? "");
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to start a reset.");
    } finally {
      setLoading(false);
    }
  }

  async function reset(event: React.FormEvent) {
    event.preventDefault();
    if (resetGate.blockSubmit()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ phone, code, password }),
      });
      setMessage(result.message);
      setStep(1);
      setCode("");
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <BackLink href={loginHref} />
      <h1 className="mt-5 font-display text-[2rem] leading-none">Reset password</h1>
      <p className="mt-2 text-sm text-muted">We will prepare a code for your Zambian number.</p>
      {error && <div className="mt-4"><Banner>{error}</Banner></div>}
      {message && <div className="mt-4"><Banner tone="success">{message}</Banner></div>}
      {devCode && <div className="mt-3"><Banner tone="info">Local development code: {devCode}</Banner></div>}
      {step === 1 ? (
        <form onSubmit={requestCode} className="mt-6 space-y-4">
          <Gate id="phone" gate={phoneGate}><Field label="Phone number" error={phoneGate.error("phone")}><PhoneField value={phone} onChange={setPhone} {...phoneGate.input("phone")} /></Field></Gate>
          <Button type="submit" loading={loading}>Send code</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="mt-6 space-y-4">
          <Gate id="code" gate={resetGate}><Field label="Reset code" error={resetGate.error("code")}><TextInput value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" {...resetGate.input("code")} /></Field></Gate>
          <Gate id="password" gate={resetGate}><Field label="New password" error={resetGate.error("password")}><PasswordField value={password} onChange={(event) => setPassword(event.target.value)} {...resetGate.input("password")} /></Field></Gate>
          <Button type="submit" loading={loading}>Update password</Button>
        </form>
      )}
    </div>
  );
}
