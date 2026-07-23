"use client";

import { useState } from "react";

type Props = {
  userId: string;
  userEmail: string;
  endpoint?: string;
};

export function AdminResetPasswordButton({ userId, userEmail, endpoint }: Props) {
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState("");

  const handleReset = async () => {
    const confirmed = window.confirm(
      `Redefinir a senha de acesso de ${userEmail}? A senha antiga não pode ser recuperada.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setTempPassword("");

    try {
      const response = await fetch(endpoint ?? `/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível redefinir a senha.");
      }

      setTempPassword(data.tempPassword);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Falha ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleReset}
        disabled={loading}
        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redefinindo..." : "Redefinir senha"}
      </button>

      {tempPassword && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
          Senha temporária: <span className="font-semibold">{tempPassword}</span>
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}