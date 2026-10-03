"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { BottomActions, PrimaryButton, Screen, TextButton, TopBar } from "@/components/ui";
import { startLogin, verifyLogin } from "@/lib/client/functions";
import type { Session } from "@/lib/client/device";

// "600 700 800" while typing.
function formatPhone(digits: string): string {
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

// Sign-in by phone number – no e-mail or password, so it works for everyone.
// Prototype: no SMS is sent; the code is always 123-123 and the screen says so.
export function PhoneLogin({
  onDone,
  title = "Podaj numer telefonu",
  intro = "Bez e-maila i hasła. Twoje zgłoszenia będą przypisane do numeru, a my damy znać, gdy urząd je przyjmie.",
  icon = "bell",
}: {
  onDone: (session: Session) => void;
  title?: string;
  intro?: string;
  icon?: IconName;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (digits.length !== 9) return setError("Wpisz 9-cyfrowy numer telefonu.");
    setBusy(true);
    setError(null);
    const res = await startLogin(digits);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setStep("code");
  }

  async function submitCode(value: string) {
    setBusy(true);
    setError(null);
    const res = await verifyLogin(digits, value);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      setCode("");
      return;
    }
    onDone(res);
  }

  if (step === "phone") {
    return (
      <Screen>
        <form onSubmit={submitPhone} className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-7 px-6 pt-7">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-accent-bg text-accent">
              <Icon name={icon} size={28} />
            </div>
            <div className="flex flex-col gap-2.5">
              <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em]">{title}</h1>
              <p className="text-pretty text-base leading-6 text-text-2">{intro}</p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Numer telefonu</span>
              <div className="flex h-16 items-center gap-3 rounded-2xl border border-field bg-bg px-4 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-ring)]">
                <span className="text-[22px] font-semibold text-text-3">+48</span>
                <span className="h-7 w-px bg-line" />
                <input
                  value={formatPhone(digits)}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  inputMode="tel"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="600 700 800"
                  aria-label="Numer telefonu"
                  className="tabular h-full min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-wide outline-none placeholder:text-text-3/60"
                  style={{ fontSize: 22 }}
                />
              </div>
              {error && <span className="text-sm text-danger">{error}</span>}
            </label>
          </div>
          <BottomActions>
            <PrimaryButton type="submit" disabled={busy || digits.length !== 9}>
              {busy ? "Wysyłam kod…" : "Wyślij kod SMS"}
            </PrimaryButton>
          </BottomActions>
        </form>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="" onBack={() => setStep("phone")} />
      <div className="flex flex-1 flex-col gap-7 px-6 pt-3">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em]">Wpisz kod z SMS</h1>
          <p className="text-base leading-6 text-text-2">
            Wysłaliśmy go na numer <b className="tabular whitespace-nowrap text-text-1">+48 {formatPhone(digits)}</b>
          </p>
        </div>
        <label className="relative flex justify-center gap-1.5" onClick={() => codeInput.current?.focus()}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="flex items-center">
              <span
                className="tabular flex h-16 w-11 items-center justify-center rounded-xl border text-[26px] font-bold"
                style={{
                  borderColor: i === code.length && !busy ? "var(--accent)" : "var(--field)",
                  boxShadow: i === code.length && !busy ? "0 0 0 3px var(--accent-ring)" : undefined,
                }}
              >
                {code[i] ?? ""}
              </span>
              {i === 2 && <span className="ml-1.5 text-2xl text-text-3">–</span>}
            </span>
          ))}
          <input
            ref={codeInput}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) void submitCode(v);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Kod z SMS"
            className="absolute inset-0 opacity-0"
          />
        </label>
        {error && <p className="text-center text-sm text-danger">{error}</p>}
        <div className="flex gap-3 rounded-2xl bg-accent-bg px-4 py-3.5 text-[15px] leading-[22px]">
          <span className="pt-0.5 text-accent">
            <Icon name="alert" />
          </span>
          <span>
            Wersja demonstracyjna: SMS nie jest wysyłany. Wpisz kod <b className="tabular">123-123</b>.
          </span>
        </div>
      </div>
      <BottomActions>
        <PrimaryButton disabled={busy || code.length !== 6} onClick={() => submitCode(code)}>
          {busy ? "Sprawdzam…" : "Potwierdź"}
        </PrimaryButton>
        <TextButton onClick={() => setStep("phone")}>Zmień numer</TextButton>
      </BottomActions>
    </Screen>
  );
}
