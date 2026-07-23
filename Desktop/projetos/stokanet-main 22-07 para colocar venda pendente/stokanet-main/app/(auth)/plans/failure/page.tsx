"use client";

import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

export default function FailurePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
        <div className="flex justify-center mb-6">
          <XCircle className="w-20 h-20 text-red-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Pagamento Recusado
        </h1>

        <p className="text-gray-600 mb-6">
          Houve um problema ao processar seu pagamento. Por favor, tente novamente.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-sm">
            Se o problema persistir, entre em contato com nosso suporte.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/plans")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Tentar Novamente
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Voltar para Dashboard
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
