"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

export default function SuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    if (countdown === 0) {
      router.push("/dashboard");
    }

    return () => clearInterval(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-20 h-20 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Pagamento Aprovado!
        </h1>

        <p className="text-gray-600 mb-6">
          Sua assinatura foi ativada com sucesso. Você tem acesso total ao sistema.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-700 font-semibold">
            Redirecionando para o dashboard em {countdown}s...
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Ir para o Dashboard Agora
        </button>

        <div className="mt-6 text-sm text-gray-600">
          <p className="mb-2">
            Você receberá um email de confirmação em breve.
          </p>
          <p>
            Caso tenha dúvidas, entre em contato com nosso suporte.
          </p>
        </div>
      </div>
    </div>
  );
}
