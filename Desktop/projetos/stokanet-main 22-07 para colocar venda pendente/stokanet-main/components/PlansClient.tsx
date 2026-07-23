"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";

interface PlansClientProps {
  hasActiveSubscription: boolean;
}

export function PlansClient({ hasActiveSubscription }: PlansClientProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [billingMode, setBillingMode] = useState<"ONE_TIME" | "RECURRING">("ONE_TIME");

  const plans = [
    {
      id: "MONTHLY",
      name: "Mensal",
      price: "R$ 100",
      period: "/mês",
      description: "Perfeito para começar",
      features: [
        "Acesso completo ao sistema",
        "Suporte por email",
        "Atualização em tempo real",
        "Até 3 usuários",
        "Backup diário",
      ],
      popular: false,
    },
    {
      id: "ANNUAL",
      name: "Anual",
      price: "R$ 1.020",
      period: "/ano",
      oldPrice: "R$ 1.200",
      description: "Economize 15%",
      features: [
        "Tudo do plano mensal",
        "Suporte prioritário",
        "Até 10 usuários",
        "Relatórios avançados",
        "API completa",
        "Backup premium",
      ],
      popular: true,
    },
  ];

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    setError("");

    try {
      const response = await fetch("/api/subscription/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingMode }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao criar pagamento");
        setLoading(null);
        return;
      }

      const { initPoint, sandboxInitPoint } = await response.json();
      const checkoutUrl = process.env.NEXT_PUBLIC_MERCADOPAGO_ENV === "production"
        ? initPoint
        : sandboxInitPoint || initPoint;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError("Erro ao redirecionar para pagamento");
      }
    } catch (err) {
      setError("Erro ao processar pedido");
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Escolha seu Plano
          </h1>
          <p className="text-xl text-gray-600">
            Acesso completo ao sistema de estoque e gestão
          </p>

          <div className="mt-6 inline-flex rounded-full bg-white/80 p-1 shadow-sm border border-gray-200">
            <button
              type="button"
              onClick={() => setBillingMode("ONE_TIME")}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                billingMode === "ONE_TIME" ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900"
              )}
            >
              Cobrança única
            </button>
            <button
              type="button"
              onClick={() => setBillingMode("RECURRING")}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                billingMode === "RECURRING" ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900"
              )}
            >
              Recorrente
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-500">
            {billingMode === "RECURRING"
              ? "Cobrança recorrente via assinatura MercadoPago, com renovação acompanhada pelo webhook."
              : "Pagamento único com validade no período escolhido."}
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={clsx(
                "relative h-full rounded-2xl overflow-hidden transition-transform hover:scale-[1.02]",
                plan.popular
                  ? "ring-2 ring-indigo-600 shadow-2xl bg-white"
                  : "bg-white shadow-lg"
              )}
            >
              {plan.popular && (
                <div className="bg-indigo-600 text-white text-center py-2 text-sm font-semibold">
                  MAIS POPULAR
                </div>
              )}

              <div className={clsx("flex h-full flex-col p-8", plan.popular ? "bg-white" : "") }>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 text-sm mb-6">{plan.description}</p>

                <div className="mb-6">
                  {plan.oldPrice && (
                    <p className="text-sm text-gray-500 line-through mb-1">
                      {plan.oldPrice}
                    </p>
                  )}
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 ml-2">{plan.period}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loading === plan.id || hasActiveSubscription}
                  className={clsx(
                    "w-full py-3 px-4 rounded-lg font-semibold transition-colors mb-8",
                    plan.popular
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-400"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900 disabled:bg-gray-300",
                    loading === plan.id && "opacity-75 cursor-wait"
                  )}
                >
                  {loading === plan.id ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin mr-2">⏳</span>
                      Processando...
                    </span>
                  ) : hasActiveSubscription ? (
                    "Já possui assinatura ativa"
                  ) : (
                    "Começar Agora"
                  )}
                </button>

                <div className="space-y-4 mt-auto">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p>Cancelamento a qualquer momento. Sem taxas ocultas.</p>
          <p>Suporte ao cliente disponível 24/7</p>
        </div>
      </div>
    </div>
  );
}
