"use client";

import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

export default function PendingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
        <div className="flex justify-center mb-6">
          <Clock className="w-20 h-20 text-yellow-600 animate-spin" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Pagamento Pendente
        </h1>

        <p className="text-gray-600 mb-6">
          Seu pagamento está sendo processado. Isso pode levar alguns minutos.
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-700 text-sm">
            Você receberá uma notificação quando o pagamento for confirmado.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Voltar para Dashboard
          </button>

          <button
            onClick={() => router.push("/plans")}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Voltar para Planos
          </button>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>
            Suporte disponível em{" "}
            <a href="mailto:support@saaestoque.com" className="text-indigo-600 hover:underline">
              support@saaestoque.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
