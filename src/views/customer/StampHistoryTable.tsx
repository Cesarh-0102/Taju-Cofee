/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Historial Detallado de Sellos y Compras - Taju Coffee House
 */

import React from 'react';
import { StampHistoryEntry, formatCurrency, formatDateTime } from '../../models/StampHistory';
import { History, Gift, CheckCircle, Clock } from 'lucide-react';

interface StampHistoryTableProps {
  history: StampHistoryEntry[];
  loading?: boolean;
}

export const StampHistoryTable: React.FC<StampHistoryTableProps> = ({
  history,
  loading = false,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs mt-4">
      
      {/* Encabezado del Historial */}
      <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#D8470A] flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-base text-[#16191C]">
              Historial Detallado de Sellos
            </h3>
            <p className="text-xs text-gray-400 font-sans">
              Registro inmutable en Firestore con monto exacto, fecha y hora de compra.
            </p>
          </div>
        </div>

        <span className="font-mono text-xs bg-gray-100 rounded-full px-3 py-1 text-gray-700">
          {history.length} {history.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {/* Contenido: Tabla o Estado Vacío */}
      {loading ? (
        <div className="py-10 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#D8470A] border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Consultando registros en Firestore...
          </p>
        </div>
      ) : history.length === 0 ? (
        <div className="py-8 text-center rounded-xl bg-gray-50 border border-dashed border-gray-200 my-3">
          <Clock className="w-7 h-7 text-gray-400 mx-auto mb-1.5 opacity-60" />
          <p className="font-display font-bold text-xs text-[#16191C]">
            Aún no tienes sellos registrados
          </p>
          <p className="text-[11px] text-gray-500 max-w-xs mx-auto mt-0.5">
            Realiza tu compra igual o superior a $15.000 en Taju Coffee House y presenta tu QR al barista.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto my-3 border border-gray-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-display uppercase tracking-wider text-[10px] border-b border-gray-200">
                <th className="py-2.5 px-3"># Sello</th>
                <th className="py-2.5 px-3">Monto Compra</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Hora Exacta</th>
                <th className="py-2.5 px-3">Ciclo</th>
                <th className="py-2.5 px-3">Estado / Premio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {history.map((entry) => {
                const { date, time } = formatDateTime(entry.createdAt);
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50/70 transition-colors"
                  >
                    {/* Número de Sello */}
                    <td className="py-2.5 px-3 font-mono font-bold text-[#D8470A]">
                      <span className="inline-block bg-orange-100 text-[#D8470A] px-2 py-0.5 rounded text-[11px]">
                        Sello #{entry.stampNumber}
                      </span>
                    </td>

                    {/* Monto Exacto de la Compra */}
                    <td className="py-2.5 px-3 font-mono font-bold text-sm text-[#16191C]">
                      {formatCurrency(entry.purchaseAmount)}
                    </td>

                    {/* Fecha */}
                    <td className="py-2.5 px-3 text-gray-700 font-medium">
                      {date}
                    </td>

                    {/* Hora Exacta */}
                    <td className="py-2.5 px-3 font-mono text-gray-400">
                      {time}
                    </td>

                    {/* Número de Ciclo */}
                    <td className="py-2.5 px-3 font-mono text-gray-600">
                      Ciclo #{entry.cycleNumber}
                    </td>

                    {/* Estado / Premio */}
                    <td className="py-2.5 px-3">
                      {entry.rewardGranted ? (
                        <span className="inline-flex items-center space-x-1 bg-[#D8470A] text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Gift className="w-3 h-3" />
                          <span>¡Premio Otorgado!</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-emerald-600 font-mono text-[11px] font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Acreditado</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
