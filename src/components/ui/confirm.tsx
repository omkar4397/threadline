"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "./button";

type Choice<T extends string> = { value: T; label: string; variant?: "primary" | "secondary" | "danger" };
type Request = {
  title: string;
  message: ReactNode;
  choices: Choice<string>[];
  resolve: (value: string | null) => void;
};

const ConfirmContext = createContext<(<T extends string>(opts: { title: string; message: ReactNode; choices: Choice<T>[] }) => Promise<T | null>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = useCallback(
    <T extends string>(opts: { title: string; message: ReactNode; choices: Choice<T>[] }) =>
      new Promise<T | null>((resolve) => {
        setRequest({ ...opts, resolve: resolve as (v: string | null) => void });
      }),
    [],
  );

  const close = (value: string | null) => {
    request?.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {request ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/40 p-4 sm:items-center" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">{request.title}</h2>
            <div className="mt-2 text-sm text-stone-600">{request.message}</div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => close(null)}>
                Cancel
              </Button>
              {request.choices.map((c) => (
                <Button key={c.value} variant={c.variant ?? "secondary"} onClick={() => close(c.value)}>
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside ConfirmProvider");
  return confirm;
}
