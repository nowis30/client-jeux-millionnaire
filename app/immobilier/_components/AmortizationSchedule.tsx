"use client";
import { useState } from "react";
import { formatMoney } from "../../../lib/format";

interface AmortizationScheduleProps {
  loanAmount: number;
  interestRate: number;
  amortizationYears: number;
  monthlyPayment: number;
}

type ScheduleRow = {
  year: number;
  beginningBalance: number;
  totalPayment: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
};

export default function AmortizationSchedule({
  loanAmount,
  interestRate,
  amortizationYears,
  monthlyPayment,
}: AmortizationScheduleProps) {
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const generateSchedule = (): ScheduleRow[] => {
    const schedule: ScheduleRow[] = [];
    const monthlyRate = interestRate / 100 / 12;
    let balance = loanAmount;

    for (let year = 1; year <= amortizationYears; year++) {
      const beginningBalance = balance;
      let yearlyPrincipal = 0;
      let yearlyInterest = 0;

      // Calculer 12 mois
      for (let month = 1; month <= 12; month++) {
        if (balance <= 0) break;

        const interestPayment = balance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;

        yearlyInterest += interestPayment;
        yearlyPrincipal += principalPayment;
        balance = Math.max(0, balance - principalPayment);
      }

      schedule.push({
        year,
        beginningBalance,
        totalPayment: monthlyPayment * 12,
        principalPaid: yearlyPrincipal,
        interestPaid: yearlyInterest,
        endingBalance: balance,
      });

      if (balance <= 0) break;
    }

    return schedule;
  };

  const schedule = generateSchedule();
  const displayedSchedule = showFullSchedule ? schedule : schedule.slice(0, 5);

  const totalInterest = schedule.reduce((sum, row) => sum + row.interestPaid, 0);
  const totalPrincipal = schedule.reduce((sum, row) => sum + row.principalPaid, 0);

  return (
    <div className="space-y-4">
      <div className="border border-sky-700/30 rounded-lg bg-sky-900/20 p-6">
        <h3 className="text-xl font-bold text-sky-200 mb-4">📊 Tableau d'amortissement</h3>

        {/* Résumé */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-neutral-800/50 rounded p-3">
            <p className="text-xs text-neutral-400 mb-1">Capital emprunté</p>
            <p className="font-semibold text-white">{formatMoney(loanAmount)}</p>
          </div>
          <div className="bg-neutral-800/50 rounded p-3">
            <p className="text-xs text-neutral-400 mb-1">Intérêts totaux</p>
            <p className="font-semibold text-amber-400">{formatMoney(totalInterest)}</p>
          </div>
          <div className="bg-neutral-800/50 rounded p-3">
            <p className="text-xs text-neutral-400 mb-1">Coût total</p>
            <p className="font-semibold text-red-400">{formatMoney(totalPrincipal + totalInterest)}</p>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sky-700/30 text-sky-300">
                <th className="text-left py-2 px-2">Année</th>
                <th className="text-right py-2 px-2">Solde début</th>
                <th className="text-right py-2 px-2">Capital</th>
                <th className="text-right py-2 px-2">Intérêts</th>
                <th className="text-right py-2 px-2">Solde fin</th>
              </tr>
            </thead>
            <tbody>
              {displayedSchedule.map((row) => (
                <tr key={row.year} className="border-b border-neutral-800 hover:bg-sky-900/10">
                  <td className="py-2 px-2 text-neutral-300">{row.year}</td>
                  <td className="py-2 px-2 text-right text-neutral-300">
                    {formatMoney(row.beginningBalance)}
                  </td>
                  <td className="py-2 px-2 text-right text-emerald-400">
                    {formatMoney(row.principalPaid)}
                  </td>
                  <td className="py-2 px-2 text-right text-amber-400">
                    {formatMoney(row.interestPaid)}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-white">
                    {formatMoney(row.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bouton voir plus/moins */}
        {schedule.length > 5 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setShowFullSchedule(!showFullSchedule)}
              className="px-4 py-2 rounded bg-sky-800/50 hover:bg-sky-700/50 text-sky-200 text-sm font-medium transition-colors"
            >
              {showFullSchedule ? "Voir moins" : `Voir toutes les ${schedule.length} années`}
            </button>
          </div>
        )}

        {/* Légende */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
            <span>Capital : remboursement du prêt</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <span>Intérêts : coût du financement</span>
          </div>
        </div>
      </div>
    </div>
  );
}
