/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Panel de Administrador y Punto de Venta (POS) - Taju Coffee House
 * Réplica exacta del panel en image_cf165636.png y pantallas complementarias
 */

import React, { useState } from 'react';
import { UserProfile } from '../../models/User';
import { useAdminController } from '../../controllers/useAdminController';
import { DigitalStampCard } from '../customer/DigitalStampCard';
import { ConcurrencyAlert } from '../components/ConcurrencyAlert';
import { QRScannerModal } from '../components/QRScannerModal';
import { AddStampModal } from './AddStampModal';
import { RegisterCustomerModal } from './RegisterCustomerModal';
import { RewardCelebrationModal } from '../components/RewardCelebrationModal';
import { StampHistoryTable } from '../customer/StampHistoryTable';
import { formatCurrency, formatDateTime } from '../../models/StampHistory';
import {
  QrCode,
  UserPlus,
  Search,
  RefreshCw,
  Gift,
  Users,
  FileText,
  Coffee,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Store,
  Touchpad,
  X,
  Plus,
  ArrowRight,
  Sparkles,
  Phone,
  CreditCard,
  Clock,
  Award,
} from 'lucide-react';

interface AdminDashboardViewProps {
  user: UserProfile;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ user }) => {
  const {
    cards,
    allCards,
    totalCardsCount,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery,
    selectedCard,
    selectedCustomerHistory,
    historyLoading,
    allHistory,
    allHistoryLoading,
    loadAllHistory,
    setSelectedCard,
    handleSelectCustomer,
    handleRefreshSelectedCustomer,
    // Modales
    isQRScannerOpen,
    setIsQRScannerOpen,
    isAddStampModalOpen,
    setIsAddStampModalOpen,
    isRegisterModalOpen,
    setIsRegisterModalOpen,
    rewardCelebrationResult,
    setRewardCelebrationResult,
    // Concurrencia y Alertas
    concurrencyConflict,
    actionError,
    actionSuccess,
    actionSubmitting,
    handleAddStamp,
    handleQRCodeScanned,
    handleRegisterNewCustomer,
    loadAllCards,
  } = useAdminController(user);

  const [activeSidebarTab, setActiveSidebarTab] = useState<'scan' | 'rewards' | 'customers' | 'history'>('scan');
  const [successBannerDismissed, setSuccessBannerDismissed] = useState(false);
  const [customersFilter, setCustomersFilter] = useState<'all' | 'near_reward' | 'gold'>('all');
  const [historyScope, setHistoryScope] = useState<'all' | 'selected'>('all');

  // Cliente por defecto si no hay ninguno seleccionado (Valentina Ríos o el primero de la lista)
  const activeCustomer = selectedCard || (cards.length > 0 ? cards[0] : allCards[0] || null);

  const stampSlots = activeCustomer
    ? Array.from({ length: 8 }, (_, i) => {
        const slotIndex = i + 1;
        const stampsCount = activeCustomer.stampsCount;
        const isFilled = stampsCount >= slotIndex;
        const isToday = isFilled && slotIndex === stampsCount;
        const isRewardSlot = slotIndex === 8;
        let dateLabel = '';
        if (isFilled) {
          dateLabel = activeCustomer.stampsDates?.[slotIndex] || (isToday ? '¡Hoy!' : `${slotIndex * 4} Feb`);
        } else if (isRewardSlot) {
          dateLabel = 'Premio';
        } else {
          dateLabel = `Faltan ${slotIndex - stampsCount}`;
        }
        return { index: slotIndex, isFilled, isToday, isRewardSlot, dateLabel };
      })
    : [];

  const progressPercent = activeCustomer ? Math.min(100, Math.round((activeCustomer.stampsCount / 8) * 100)) : 0;
  const stampsRemaining = activeCustomer ? Math.max(0, 8 - activeCustomer.stampsCount) : 8;

  // Filtrado específico para la pestaña de Fidelizados
  const filteredCustomersList = (cards.length > 0 ? cards : allCards).filter((c) => {
    if (customersFilter === 'near_reward') {
      return c.stampsCount >= 6;
    }
    if (customersFilter === 'gold') {
      return c.loyaltyLevel?.includes('GOLD') || c.totalCyclesCompleted >= 1;
    }
    return true;
  });

  // Clientes con recompensas listas o próximas a ganar
  const clientsNearReward = allCards.filter((c) => c.stampsCount >= 6);

  // Historial activo para mostrar
  const displayedHistory = historyScope === 'selected' && activeCustomer
    ? selectedCustomerHistory
    : allHistory;

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col md:flex-row">
      
      {/* SIDEBAR LATERAL (image_cf165636.png y image_0dccfca8.png) */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col justify-between p-4 flex-shrink-0">
        <div className="space-y-6">
          
          {/* Logo Taju Coffee Specialty */}
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-[#D8470A] text-white flex items-center justify-center shadow-sm">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-sm text-[#16191C] leading-tight">
                Taju Coffee
              </h2>
              <p className="text-[10px] text-gray-500 font-sans tracking-wide">
                Specialty Coffee
              </p>
            </div>
          </div>

          {/* Menú de Navegación Lateral */}
          <nav className="space-y-1.5">
            {/* 1. ESCANEAR Y SUMAR */}
            <button
              onClick={() => setActiveSidebarTab('scan')}
              className={`w-full py-3 px-3.5 rounded-xl text-xs font-display font-bold uppercase tracking-wider flex items-center space-x-2.5 transition-all cursor-pointer ${
                activeSidebarTab === 'scan'
                  ? 'btn-taju-primary shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Escanear y Sumar</span>
            </button>

            {/* 2. NUEVO CLIENTE (Abre modal de registro inmediato) */}
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs font-display font-bold text-gray-700 hover:bg-gray-100 flex items-center space-x-2.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#D8470A]" />
              <span>Nuevo Cliente</span>
            </button>

            {/* 3. RECOMPENSAS */}
            <button
              onClick={() => setActiveSidebarTab('rewards')}
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-display font-bold flex items-center space-x-2.5 transition-all cursor-pointer ${
                activeSidebarTab === 'rewards'
                  ? 'bg-orange-50 text-[#D8470A] font-extrabold border border-orange-200/60'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Gift className={`w-4 h-4 ${activeSidebarTab === 'rewards' ? 'text-[#D8470A]' : 'text-gray-500'}`} />
              <span>Recompensas</span>
            </button>

            {/* 4. FIDELIZADOS */}
            <button
              onClick={() => setActiveSidebarTab('customers')}
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-display font-bold flex items-center space-x-2.5 transition-all cursor-pointer ${
                activeSidebarTab === 'customers'
                  ? 'bg-orange-50 text-[#D8470A] font-extrabold border border-orange-200/60'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Users className={`w-4 h-4 ${activeSidebarTab === 'customers' ? 'text-[#D8470A]' : 'text-gray-500'}`} />
              <span>Fidelizados</span>
            </button>

            {/* 5. MOVIMIENTOS */}
            <button
              onClick={() => {
                setActiveSidebarTab('history');
                loadAllHistory();
              }}
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-display font-bold flex items-center space-x-2.5 transition-all cursor-pointer ${
                activeSidebarTab === 'history'
                  ? 'bg-orange-50 text-[#D8470A] font-extrabold border border-orange-200/60'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FileText className={`w-4 h-4 ${activeSidebarTab === 'history' ? 'text-[#D8470A]' : 'text-gray-500'}`} />
              <span>Movimientos</span>
            </button>
          </nav>
        </div>

        {/* Indicador inferior de Terminal */}
        <div className="pt-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80">
            <div className="flex items-center space-x-1.5 text-[10px] font-mono text-emerald-600 font-bold uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>TERMINAL TPV #02</span>
            </div>
            <p className="text-[11px] font-sans font-medium text-gray-700 mt-0.5">
              Barra Principal Este
            </p>
          </div>
        </div>
      </aside>

      {/* ÁREA CENTRAL PRINCIPAL */}
      <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-6xl space-y-5">
        
        {/* Banner de Éxito / Estado (image_cf165636.png) */}
        {!successBannerDismissed && activeCustomer && (
          <div className="bg-white border border-gray-200 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded-full bg-[#D8470A] text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-800 font-sans">
                <strong className="font-bold text-[#D8470A]">¡Cliente activo: {activeCustomer.customerName} ({activeCustomer.stampsCount}/8 sellos)!</strong>
                <span className="text-gray-500 ml-1.5">· A solo {stampsRemaining} sellos de la recompensa de la casa.</span>
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-[11px] font-sans font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                Sede Chapinero
              </span>
              <button
                onClick={() => setSuccessBannerDismissed(true)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Alerta de Conflicto de Concurrencia (OCC) */}
        {concurrencyConflict?.detected && (
          <ConcurrencyAlert
            expectedVersion={concurrencyConflict.expectedVersion}
            actualVersion={concurrencyConflict.actualVersion}
            message={concurrencyConflict.message}
            onRefresh={handleRefreshSelectedCustomer}
            refreshing={refreshing}
          />
        )}

        {/* Notificaciones dinámicas de acción */}
        {actionSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-center space-x-2 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
        )}

        {actionError && !concurrencyConflict?.detected && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl flex items-center space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="font-medium">{actionError}</span>
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 1: ESCANEAR Y SUMAR (TPV POS PRINCIPAL - image_cf165636.png)
           ========================================================================= */}
        {activeSidebarTab === 'scan' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* TARJETA DE BÚSQUEDA DE CLIENTE */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="font-display font-extrabold text-xl text-[#16191C]">
                    Buscar cliente
                  </h2>
                  <p className="text-xs text-gray-500 font-sans">
                    Busca por nombre, teléfono o documento de identificación (Cédula C.C.) para asignar sellos o canjes.
                  </p>
                </div>

                <div className="inline-flex items-center space-x-1.5 text-[11px] font-sans font-medium text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                  <Touchpad className="w-3.5 h-3.5 text-[#D8470A]" />
                  <span>Modo pantalla táctil POS activo</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Escribe: Valentina Ríos, Santiago Vélez, Cédula (ej: 1098742516) o Teléfono..."
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#D8470A] focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#16191C] font-sans outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (cards.length > 0) {
                      handleSelectCustomer(cards[0]);
                    }
                  }}
                  className="w-full sm:w-auto btn-taju-primary text-xs font-display font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar</span>
                </button>

                <button
                  onClick={() => {
                    setSearchQuery('');
                    loadAllCards();
                  }}
                  className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-sans font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nueva búsqueda</span>
                </button>

                <button
                  onClick={() => setIsQRScannerOpen(true)}
                  className="w-full sm:w-auto bg-orange-50 hover:bg-orange-100 text-[#D8470A] border border-orange-200 text-xs font-sans font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Cámara QR</span>
                </button>
              </div>

              {/* Resultados de búsqueda rápida si hay coincidencia */}
              {searchQuery && (
                <div className="mt-3 pt-3 border-t border-gray-100 max-h-52 overflow-y-auto space-y-1">
                  {cards.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-lg">
                      No se encontró ningún cliente con "<span className="font-bold">{searchQuery}</span>". 
                      <button
                        onClick={() => setIsRegisterModalOpen(true)}
                        className="ml-2 text-[#D8470A] font-bold underline cursor-pointer"
                      >
                        ¿Deseas registrarlo ahora?
                      </button>
                    </div>
                  ) : (
                    cards.map((c) => (
                      <button
                        key={c.customerId}
                        onClick={() => {
                          handleSelectCustomer(c);
                          setSearchQuery('');
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex justify-between items-center transition-colors cursor-pointer ${
                          activeCustomer?.customerId === c.customerId ? 'bg-orange-100/70 border border-orange-300' : 'hover:bg-orange-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#D8470A]/10 text-[#D8470A] font-bold flex items-center justify-center text-xs">
                            {c.customerName?.charAt(0) || 'C'}
                          </div>
                          <div>
                            <span className="font-bold text-[#16191C] block">{c.customerName}</span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              {c.documentNumber || 'Sin cédula'} · Tel: {c.phone || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#D8470A] block">{c.stampsCount}/8 sellos</span>
                          <span className="text-[10px] text-gray-400 font-sans">Seleccionar cliente →</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* LAYOUT PRINCIPAL DE 2 COLUMNAS (image_cf165636.png) */}
            {activeCustomer ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* COLUMNA IZQUIERDA: Tarjeta Oscura de Lujo y Botones de Acción */}
                <div className="lg:col-span-8 space-y-4">
                  <DigitalStampCard
                    card={activeCustomer}
                    stampSlots={stampSlots}
                    progressPercent={progressPercent}
                    stampsRemaining={stampsRemaining}
                    onOpenQR={() => setIsQRScannerOpen(true)}
                    showAdminInfo={true}
                  />

                  {/* BARRA DE ACCIÓN INFERIOR (image_cf165636.png) */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                      <button
                        onClick={() => setIsAddStampModalOpen(true)}
                        className="flex-1 sm:flex-none btn-taju-primary text-xs font-display font-bold uppercase tracking-wider px-5 py-3 rounded-xl shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Coffee className="w-4 h-4" />
                        <span>Agregar sello (+1)</span>
                      </button>

                      <button
                        onClick={() => handleRefreshSelectedCustomer()}
                        disabled={refreshing}
                        className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-sans font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>Sincronizar Firestore</span>
                      </button>
                    </div>

                    <div className="text-[11px] font-sans text-gray-500 flex items-center space-x-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-[#D8470A]" />
                      <span>
                        Último sello: <strong className="text-gray-800">{activeCustomer.lastStampTime || 'Hoy 10:24 AM'} ({activeCustomer.lastStampNotes || 'Americano Doble'})</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: Perfil del Cliente & Terminal POS */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <h3 className="font-display font-bold text-sm text-[#16191C]">
                          Perfil del Cliente
                        </h3>
                      </div>
                      <span className="bg-[#FFEDE5] text-[#D8470A] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        Activo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <span className="text-[10px] uppercase font-mono text-gray-400 block">
                          VISITAS TOTALES
                        </span>
                        <div className="font-display font-extrabold text-2xl text-[#16191C] mt-0.5">
                          {activeCustomer.totalVisits || 1}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          +{activeCustomer.stampsCount} este ciclo
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <span className="text-[10px] uppercase font-mono text-gray-400 block">
                          CICLOS CANJEADOS
                        </span>
                        <div className="font-display font-extrabold text-2xl text-[#16191C] mt-0.5">
                          {activeCustomer.totalCyclesCompleted || 0}
                        </div>
                        <span className="text-[10px] text-gray-500 font-sans">
                          {(activeCustomer.totalCyclesCompleted || 0) * 8} sellos previos
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-mono text-gray-400 font-bold block mb-1">
                        NOTAS Y BEBIDA FAVORITA
                      </span>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-700 font-sans">
                        {activeCustomer.favoriteDrinkNotes || 'Americano Doble con leche de avena · Sin azúcar'}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-[11px] font-sans text-gray-500 space-y-1">
                        <p><strong className="text-gray-700">Documento:</strong> {activeCustomer.documentNumber || 'C.C. No registrada'}</p>
                        <p><strong className="text-gray-700">WhatsApp:</strong> {activeCustomer.phone || 'No registrado'}</p>
                        <p><strong className="text-gray-700">Código Membresía:</strong> <span className="font-mono text-[#D8470A] font-bold">{activeCustomer.memberCode || '#7821-TJ'}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta Información de Terminal POS */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#D8470A] flex-shrink-0">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-gray-400 block">
                          TERMINAL TAJU POS #02
                        </span>
                        <h4 className="font-bold text-xs text-[#16191C] mt-0.5">
                          Sede Chapinero (Cra 7 #54-20)
                        </h4>
                        <p className="text-[11px] text-gray-500 font-sans mt-0.5">
                          Turno Activo: Barista #04 Carlos Mendoza
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Coffee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-display font-bold text-base text-gray-700">No hay cliente seleccionado</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Utiliza la barra de búsqueda superior para encontrar un cliente o haz clic en "Nuevo Cliente" para registrarlo.
                </p>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 2: FIDELIZADOS (DIRECTORIO DE CLIENTES - image_0dccfca8.png)
           ========================================================================= */}
        {activeSidebarTab === 'customers' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header del Directorio */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#D8470A] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h2 className="font-display font-extrabold text-xl text-[#16191C]">
                    Clientes Fidelizados
                  </h2>
                  <span className="bg-[#FFEDE5] text-[#D8470A] text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                    {allCards.length} {allCards.length === 1 ? 'cliente' : 'clientes'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-sans mt-1">
                  Directorio sincronizado directamente con Firebase Firestore (Single Source of Truth).
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="btn-taju-primary text-xs font-display font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Cliente</span>
                </button>

                <button
                  onClick={() => loadAllCards()}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refrescar</span>
                </button>
              </div>
            </div>

            {/* Filtros rápidos y buscador */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, cédula o tel..."
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#D8470A] focus:bg-white rounded-xl pl-9 pr-8 py-2 text-xs text-[#16191C] font-sans outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Botones de filtro de estado */}
              <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  onClick={() => setCustomersFilter('all')}
                  className={`text-xs font-sans font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    customersFilter === 'all'
                      ? 'bg-[#16191C] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Todos ({allCards.length})
                </button>

                <button
                  onClick={() => setCustomersFilter('near_reward')}
                  className={`text-xs font-sans font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    customersFilter === 'near_reward'
                      ? 'bg-[#D8470A] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Cerca de premio (6-7 sellos)
                </button>

                <button
                  onClick={() => setCustomersFilter('gold')}
                  className={`text-xs font-sans font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    customersFilter === 'gold'
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Nivel Gold
                </button>
              </div>
            </div>

            {/* TABLA PRINCIPAL DE CLIENTES FIDELIZADOS */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-display uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Cliente / Titular</th>
                      <th className="py-3 px-4">Documento (C.C.)</th>
                      <th className="py-3 px-4">WhatsApp / Teléfono</th>
                      <th className="py-3 px-4">Nivel & Sede</th>
                      <th className="py-3 px-4">Progreso de Sellos</th>
                      <th className="py-3 px-4">Ciclos / Canjes</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans">
                    {filteredCustomersList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-400">
                          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="font-bold text-gray-600">No se encontraron clientes</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Prueba con otro término de búsqueda o crea un nuevo cliente.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomersList.map((customer) => {
                        const pct = Math.min(100, Math.round((customer.stampsCount / 8) * 100));
                        const isSelected = activeCustomer?.customerId === customer.customerId;

                        return (
                          <tr
                            key={customer.customerId}
                            className={`hover:bg-orange-50/40 transition-colors ${isSelected ? 'bg-orange-50/70' : ''}`}
                          >
                            {/* Nombre y Avatar */}
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-[#D8470A] text-white font-bold flex items-center justify-center text-xs shadow-xs">
                                  {customer.customerName?.charAt(0) || 'C'}
                                </div>
                                <div>
                                  <span className="font-bold text-sm text-[#16191C] block">
                                    {customer.customerName}
                                  </span>
                                  <span className="text-[11px] text-gray-400 font-mono">
                                    {customer.customerEmail}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Cédula */}
                            <td className="py-3 px-4 font-mono font-medium text-gray-700">
                              {customer.documentNumber || 'CC •••• 7821'}
                            </td>

                            {/* Teléfono */}
                            <td className="py-3 px-4 font-mono text-gray-600">
                              <span className="inline-flex items-center space-x-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{customer.phone || '+57 312 ••• 9021'}</span>
                              </span>
                            </td>

                            {/* Nivel */}
                            <td className="py-3 px-4">
                              <span className="inline-block bg-[#FFEDE5] text-[#D8470A] font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">
                                {customer.loyaltyLevel || 'NIVEL GOLD'}
                              </span>
                              <span className="block text-[10px] text-gray-400 mt-0.5">
                                {customer.branch || 'Sede Chapinero'}
                              </span>
                            </td>

                            {/* Progreso de sellos visual */}
                            <td className="py-3 px-4 min-w-[150px]">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-[#D8470A]">
                                  {customer.stampsCount} de 8 sellos
                                </span>
                                <span className="font-mono text-gray-400">{pct}%</span>
                              </div>
                              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#D8470A] h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>

                            {/* Ciclos completados */}
                            <td className="py-3 px-4 font-mono text-center">
                              <span className="font-bold text-sm text-[#16191C]">
                                {customer.totalCyclesCompleted || 0}
                              </span>
                              <span className="block text-[10px] text-gray-400">
                                canjes previos
                              </span>
                            </td>

                            {/* Acciones */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => {
                                    handleSelectCustomer(customer);
                                    setActiveSidebarTab('scan');
                                  }}
                                  className="btn-taju-primary text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-2xs flex items-center space-x-1 cursor-pointer"
                                  title="Seleccionar en caja POS"
                                >
                                  <span>Caja POS</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => {
                                    handleSelectCustomer(customer);
                                    setIsAddStampModalOpen(true);
                                  }}
                                  className="bg-orange-100 hover:bg-orange-200 text-[#D8470A] font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                  title="Agregar un sello de compra"
                                >
                                  +1 Sello
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 3: RECOMPENSAS (image_0dccfca8.png)
           ========================================================================= */}
        {activeSidebarTab === 'rewards' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Header de Recompensas */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#D8470A] flex items-center justify-center">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display font-extrabold text-xl text-[#16191C]">
                    Programa de Recompensas Taju Coffee
                  </h2>
                  <p className="text-xs text-gray-500 font-sans">
                    Beneficios e incentivos activos para la Sede Chapinero (Bogotá).
                  </p>
                </div>
              </div>

              {/* Grid de Recompensas del Local */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                {/* 1. Premio 8º Sello */}
                <div className="bg-gradient-to-br from-[#1E2024] to-[#141619] rounded-2xl p-5 text-white border border-amber-900/40 relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#D8470A]/20 rounded-full blur-2xl" />
                  <div className="flex items-center space-x-2 text-xs font-bold text-[#E8734A] uppercase tracking-wider mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Premio Mayor (8 Sellos)</span>
                  </div>
                  <h3 className="font-display font-extrabold text-base text-white">
                    Café de Especialidad + Pastelería Artesanal
                  </h3>
                  <p className="text-xs text-gray-400 font-sans mt-1.5 leading-relaxed">
                    Cortesía de la casa a elección: Filtrado en V60 o Aeropress + Croissant de Almendras o Torta de Zanahoria.
                  </p>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-gray-400">
                    <span>Requisito: 8 Sellos</span>
                    <span className="text-emerald-400 font-bold">Auto-canjeable</span>
                  </div>
                </div>

                {/* 2. Beneficio Nivel Gold */}
                <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs relative">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                    <Award className="w-4 h-4" />
                    <span>Beneficio Nivel Gold</span>
                  </div>
                  <h3 className="font-display font-extrabold text-base text-[#16191C]">
                    10% Descuento en Café en Grano
                  </h3>
                  <p className="text-xs text-gray-600 font-sans mt-1.5 leading-relaxed">
                    Descuento preferencial en bolsas de 250g de micro-lotes seleccionados y en métodos de extracción para llevar a casa.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-500">
                    <span>Clientes con &gt;1 ciclo</span>
                    <span className="text-[#D8470A] font-bold">Permanente</span>
                  </div>
                </div>

                {/* 3. Regalo de Cumpleaños */}
                <div className="bg-white rounded-2xl p-5 border border-orange-200 shadow-xs relative">
                  <div className="flex items-center space-x-2 text-xs font-bold text-[#D8470A] uppercase tracking-wider mb-2">
                    <Coffee className="w-4 h-4" />
                    <span>Regalo de Cumpleaños</span>
                  </div>
                  <h3 className="font-display font-extrabold text-base text-[#16191C]">
                    Bebida Especial de Cumpleaños
                  </h3>
                  <p className="text-xs text-gray-600 font-sans mt-1.5 leading-relaxed">
                    Durante todo el mes de su cumpleaños, el cliente recibe 1 bebida artesanal gratis de cortesía en barra.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-500">
                    <span>Verificado por cédula</span>
                    <span className="text-emerald-600 font-bold">1 vez al año</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Clientes a punto de ganar o listos para canje */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs">
              <h3 className="font-display font-extrabold text-base text-[#16191C] mb-1">
                Clientes Cercanos a Recompensa (6 o más sellos)
              </h3>
              <p className="text-xs text-gray-500 font-sans mb-4">
                Identifica a los clientes frecuentes para felicitarlos e incentivar su canje en su próxima visita.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientsNearReward.map((c) => {
                  const remaining = Math.max(0, 8 - c.stampsCount);
                  return (
                    <div
                      key={c.customerId}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#16191C]">{c.customerName}</span>
                          <span className="bg-[#D8470A] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {c.stampsCount}/8 sellos
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">{c.documentNumber}</p>
                        
                        <div className="mt-3 bg-white p-2.5 rounded-lg border border-gray-200">
                          <p className="text-xs text-[#D8470A] font-bold">
                            {remaining === 0 ? '¡Listo para canjear premio!' : `A solo ${remaining} ${remaining === 1 ? 'sello' : 'sellos'} del premio`}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Bebida favorita: {c.favoriteDrinkNotes || 'Americano Doble'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                        <button
                          onClick={() => {
                            handleSelectCustomer(c);
                            setIsAddStampModalOpen(true);
                          }}
                          className="btn-taju-primary text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                        >
                          <Coffee className="w-3.5 h-3.5" />
                          <span>Asignar sello</span>
                        </button>

                        <button
                          onClick={() => {
                            handleSelectCustomer(c);
                            setActiveSidebarTab('scan');
                          }}
                          className="text-xs text-gray-600 font-bold hover:text-[#D8470A] cursor-pointer"
                        >
                          Ver tarjeta →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 4: MOVIMIENTOS (AUDITORÍA COMPLETA - image_0dccfca8.png)
           ========================================================================= */}
        {activeSidebarTab === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header de Auditoría */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#D8470A] flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h2 className="font-display font-extrabold text-xl text-[#16191C]">
                    Registro y Auditoría de Movimientos POS
                  </h2>
                </div>
                <p className="text-xs text-gray-500 font-sans mt-1">
                  Historial de sellos otorgados con monto de compra exacto (mínimo $15.000 COP), fecha y hora.
                </p>
              </div>

              {/* Selector de Ámbito: Todos vs Cliente Activo */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setHistoryScope('all')}
                  className={`text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer ${
                    historyScope === 'all'
                      ? 'bg-[#16191C] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Toda la Sede ({allHistory.length})
                </button>

                {activeCustomer && (
                  <button
                    onClick={() => setHistoryScope('selected')}
                    className={`text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer ${
                      historyScope === 'selected'
                        ? 'btn-taju-primary'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Solo {activeCustomer.customerName}
                  </button>
                )}

                <button
                  onClick={() => loadAllHistory()}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${allHistoryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* TABLA DE MOVIMIENTOS */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden p-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 font-display uppercase tracking-wider text-[10px] border-b border-gray-200">
                      <th className="py-2.5 px-3"># Sello</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Monto Compra</th>
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3">Ciclo</th>
                      <th className="py-2.5 px-3">Detalle / Notas</th>
                      <th className="py-2.5 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans">
                    {displayedHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-gray-400">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="font-bold">No hay transacciones registradas todavía</p>
                          <p className="text-[11px] mt-0.5">Asigna el primer sello desde el Punto de Venta.</p>
                        </td>
                      </tr>
                    ) : (
                      displayedHistory.map((entry) => {
                        const { date, time } = formatDateTime(entry.createdAt);
                        return (
                          <tr key={entry.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#D8470A]">
                              <span className="inline-block bg-orange-100 text-[#D8470A] px-2 py-0.5 rounded text-[11px]">
                                Sello #{entry.stampNumber}
                              </span>
                            </td>

                            <td className="py-2.5 px-3">
                              <span className="font-bold text-[#16191C] block">
                                {entry.customerName || 'Cliente Taju'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                Barista: {entry.adminEmail ? entry.adminEmail.split('@')[0] : 'Carlos Mendoza'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 font-mono font-bold text-sm text-[#16191C]">
                              {formatCurrency(entry.purchaseAmount)}
                            </td>

                            <td className="py-2.5 px-3 text-gray-700">
                              <span className="font-medium block">{date}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{time}</span>
                            </td>

                            <td className="py-2.5 px-3 font-mono text-gray-600">
                              Ciclo #{entry.cycleNumber}
                            </td>

                            <td className="py-2.5 px-3 text-gray-600">
                              {entry.notes || 'Compra café especial'}
                            </td>

                            <td className="py-2.5 px-3">
                              {entry.rewardGranted ? (
                                <span className="inline-flex items-center space-x-1 bg-[#D8470A] text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  <Gift className="w-3 h-3" />
                                  <span>¡Premio Ganado!</span>
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modales */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanSuccess={handleQRCodeScanned}
        knownCustomerIds={allCards.map((c) => ({ id: c.customerId, name: c.customerName }))}
      />

      <AddStampModal
        isOpen={isAddStampModalOpen}
        onClose={() => setIsAddStampModalOpen(false)}
        card={activeCustomer}
        onConfirm={handleAddStamp}
        submitting={actionSubmitting}
      />

      <RegisterCustomerModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegister={handleRegisterNewCustomer}
        submitting={actionSubmitting}
      />

      <RewardCelebrationModal
        isOpen={Boolean(rewardCelebrationResult)}
        onClose={() => setRewardCelebrationResult(null)}
        customerName={activeCustomer?.customerName}
        totalCycles={rewardCelebrationResult?.totalCyclesCompleted ?? 1}
      />
    </div>
  );
};
