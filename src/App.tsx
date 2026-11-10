/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TAJU COFFEE HOUSE - Aplicación Web de Fidelización de Clientes
 * 
 * Arquitectura MVC en Frontend:
 * - /models: User, LoyaltyCard, StampHistory
 * - /services: Firebase Auth, Firestore Single Source of Truth, OCC, Transacciones Atómicas
 * - /controllers: useAuthController, useCustomerCardController, useAdminController
 * - /views: LoginView, AdminDashboardView, CustomerDashboardView
 */

import React from 'react';
import { useAuthController } from './controllers/useAuthController';
import { BrutalistHeader } from './views/components/BrutalistHeader';
import { LoginView } from './views/auth/LoginView';
import { AdminDashboardView } from './views/admin/AdminDashboardView';
import { CustomerDashboardView } from './views/customer/CustomerDashboardView';

export default function App() {
  const {
    user,
    loading,
    error,
    actionLoading,
    login,
    register,
    loginWithGoogle,
    logout,
    quickDemoLogin,
    resetPassword,
    sendPasswordResetEmail,
  } = useAuthController();

  // Pantalla de Carga Inicial con el Logo Oficial de Taju
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4">
        <div className="relative mb-4">
          <img
            src="/assets/aistudio/image_4501393a.png"
            alt="Taju Coffee House"
            className="w-20 h-20 rounded-full object-cover shadow-xl border-2 border-amber-900/30 animate-pulse"
          />
        </div>
        <h2 className="font-display font-extrabold text-xl text-[#16191C]">
          Taju Coffee House
        </h2>
        <p className="text-xs text-[#D8470A] font-bold uppercase tracking-widest mt-0.5">
          Specialty Coffee · Bogotá
        </p>
        <p className="text-[11px] font-mono text-gray-400 mt-2">
          Conectando con Firebase Firestore (Single Source of Truth)...
        </p>
      </div>
    );
  }

  // Si no hay usuario autenticado: Pantalla de Login Unificado
  if (!user) {
    return (
      <LoginView
        onLogin={login}
        onRegister={register}
        onResetPassword={resetPassword}
        onSendPasswordResetEmail={sendPasswordResetEmail}
        onGoogleLogin={loginWithGoogle}
        onQuickDemoLogin={quickDemoLogin}
        loading={actionLoading}
        error={error}
      />
    );
  }

  // Usuario Autenticado: Detección automática y enrutamiento según rol
  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#16191C] flex flex-col">
      {/* Barra de Navegación Superior */}
      <BrutalistHeader user={user} onLogout={logout} />

      {/* Enrutamiento por Rol (Admin vs Cliente) */}
      <main className="flex-1">
        {user.role === 'admin' ? (
          <AdminDashboardView user={user} />
        ) : (
          <CustomerDashboardView user={user} />
        )}
      </main>

      {/* Pie de Página */}
      <footer className="border-t border-gray-200 py-3.5 px-4 text-center text-[11px] font-sans text-gray-400 bg-white">
        Taju Coffee House · Cra 7 #54-20, Sede Chapinero · Bogotá · Single Source of Truth OCC
      </footer>
    </div>
  );
}
