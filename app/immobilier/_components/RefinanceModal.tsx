"use client";
import { useState } from "react";
import { formatMoney } from "../../../lib/format";

type Property = {
  id: string;
  name: string;
  currentValue: number;
  remainingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  quantity: number;
};

interface RefinanceModalProps {
  property: Property;
  onClose: () => void;
  onConfirm: (propertyId: string, newRate: number, newYears: number) => Promise<void>;
}

export default function RefinanceModal({ property, onClose, onConfirm }: RefinanceModalProps) {
  const [newYears, setNewYears] = useState(25);
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      // Le taux envoyé ici n'est qu'un fallback de compatibilité. Le moteur
      // applique autoritairement le taux du marché de la partie au refinancement.
      await onConfirm(property.id, property.interestRate, newYears);
      onClose();
    } catch (error) {
      console.error("Erreur lors du refinancement:", error);
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-[#171b28] to-[#0b0e16] p-4 sm:p-6 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300">Financement</p>
            <h3 className="text-2xl font-black text-white">Refinancer</h3>
            <p className="text-sm text-neutral-400">{property.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="ui-touch grid place-items-center rounded-full border border-white/10 bg-white/5 text-xl text-white"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Solde</p>
            <p className="font-bold text-white">{formatMoney(property.remainingBalance * property.quantity)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Taux actuel</p>
            <p className="font-bold text-white">{property.interestRate.toFixed(2)}%</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.045] p-3 flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-400">Paiement mensuel actuel</span>
            <span className="font-bold text-amber-300">{formatMoney(property.monthlyPayment * property.quantity)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4 mb-4">
          <div className="font-bold text-cyan-100 mb-1">Taux fixé par le marché</div>
          <p className="text-sm leading-relaxed text-cyan-100/70">
            Le taux de refinancement n'est pas choisi par le joueur. Le moteur applique le taux hypothécaire courant de la partie au moment de confirmer.
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-neutral-200 mb-2">
            Nouvelle durée
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[15, 20, 25].map((years) => (
              <button
                key={years}
                type="button"
                onClick={() => setNewYears(years)}
                className={[
                  "min-h-12 rounded-2xl border text-sm font-bold transition",
                  newYears === years
                    ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.045] text-neutral-300",
                ].join(" ")}
              >
                {years} ans
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 mb-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-300">Nouvelle durée</span>
            <span className="font-black text-emerald-300">{newYears} ans</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Le nouveau paiement est calculé côté serveur avec le solde restant, la durée choisie et le taux courant. Aucun faux frais de refinancement n'est ajouté par l'interface.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={processing}
            className="ui-btn ui-btn--neutral w-full"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing}
            className="ui-btn ui-btn--primary w-full"
          >
            {processing ? "Traitement…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
