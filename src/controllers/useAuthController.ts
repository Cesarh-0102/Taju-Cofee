/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador de Autenticación - Taju Coffee House
 */

import { useState, useEffect, useCallback } from 'react';
import { UserProfile, AuthState } from '../models/User';
import {
  subscribeToAuthChanges,
  getOrCreateUserProfile,
  loginWithEmail,
  registerCustomer,
  loginWithGoogle,
  logoutUser,
  initializeLoyaltyCardForCustomer,
  resetOrSetCustomerPassword,
  sendResetPasswordEmail,
  CustomerRegistrationPayload,
} from '../services/authService';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useAuthController() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAdmin: false,
    isCustomer: false,
  });

  const [authActionLoading, setAuthActionLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
      if (!firebaseUser) {
        setAuthState({
          user: null,
          loading: false,
          error: null,
          isAdmin: false,
          isCustomer: false,
        });
        return;
      }

      try {
        const profile = await getOrCreateUserProfile(firebaseUser);
        setAuthState({
          user: profile,
          loading: false,
          error: null,
          isAdmin: profile.role === 'admin',
          isCustomer: profile.role === 'customer',
        });
      } catch (err: any) {
        console.error('[useAuthController] Error resolviendo perfil:', err);
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: 'Error al verificar sesión en Firebase.',
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setAuthActionLoading(true);
    setAuthState((prev) => ({ ...prev, error: null }));
    try {
      const profile = await loginWithEmail(email, pass);
      setAuthState({
        user: profile,
        loading: false,
        error: null,
        isAdmin: profile.role === 'admin',
        isCustomer: profile.role === 'customer',
      });
      return profile;
    } catch (err: any) {
      const message = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
        ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
        : err.code === 'auth/user-not-found'
        ? 'Usuario no encontrado en Taju Coffee House.'
        : err.message || 'Error al iniciar sesión.';
      setAuthState((prev) => ({ ...prev, error: message }));
      throw err;
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  const handleRegister = useCallback(async (payload: CustomerRegistrationPayload) => {
    setAuthActionLoading(true);
    setAuthState((prev) => ({ ...prev, error: null }));
    try {
      const profile = await registerCustomer(payload);
      setAuthState({
        user: profile,
        loading: false,
        error: null,
        isAdmin: false,
        isCustomer: true,
      });
      return profile;
    } catch (err: any) {
      const message = err.code === 'auth/email-already-in-use'
        ? 'Este correo ya se encuentra registrado. Inicia sesión.'
        : err.code === 'auth/weak-password'
        ? 'La contraseña debe tener al menos 6 caracteres.'
        : err.message || 'Error al registrar cliente.';
      setAuthState((prev) => ({ ...prev, error: message }));
      throw err;
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    setAuthActionLoading(true);
    setAuthState((prev) => ({ ...prev, error: null }));
    try {
      const profile = await loginWithGoogle();
      setAuthState({
        user: profile,
        loading: false,
        error: null,
        isAdmin: profile.role === 'admin',
        isCustomer: profile.role === 'customer',
      });
      return profile;
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, error: 'Error al autenticar con Google.' }));
      throw err;
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
      setAuthState({
        user: null,
        loading: false,
        error: null,
        isAdmin: false,
        isCustomer: false,
      });
    } catch (err: any) {
      console.error('[useAuthController] Error cerrando sesión:', err);
    }
  }, []);

  /**
   * Accesos Rápidos Demo exactos a las imágenes de muestra
   * Admin: Carlos Mendoza (Barista Principal)
   * Cliente: Valentina Ríos (Nivel Gold, 5 de 8 sellos)
   */
  const handleQuickDemoLogin = useCallback(async (role: 'admin' | 'customer') => {
    setAuthActionLoading(true);
    setAuthState((prev) => ({ ...prev, error: null }));
    try {
      const demoEmail = role === 'admin' ? 'carlos.mendoza@taju.co' : 'valentina.rios@taju.co';
      const demoPass = 'TajuCoffee2026!';
      const demoName = role === 'admin' ? 'Carlos Mendoza' : 'Valentina Ríos';

      try {
        await handleLogin(demoEmail, demoPass);
      } catch (loginErr: any) {
        if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
          const profile = await registerCustomer({
            email: demoEmail,
            name: demoName,
            password: demoPass,
            phone: role === 'customer' ? '+57 312 458 9021' : '+57 315 220 1199',
            documentType: 'Cédula C.C.',
            documentNumber: role === 'customer' ? '1098742516' : '80234112',
          });
          if (role === 'admin') {
            profile.role = 'admin';
            await setDoc(doc(db, 'users', profile.uid), { role: 'admin' }, { merge: true });
            await setDoc(doc(db, 'admins', profile.uid), { email: demoEmail, assignedAt: new Date().toISOString() });
          } else {
            // Inicializar a Valentina con 5 sellos como en la captura
            await setDoc(doc(db, 'loyaltyCards', profile.uid), {
              stampsCount: 5,
              totalVisits: 21,
              totalCyclesCompleted: 2,
              lastStampNotes: 'Americano Doble',
              lastStampTime: 'Hoy 10:24 AM',
              stampsDates: {
                1: '12 Feb',
                2: '18 Feb',
                3: '24 Feb',
                4: '01 Mar',
                5: 'Hoy',
              },
            }, { merge: true });
          }
          setAuthState({
            user: profile,
            loading: false,
            error: null,
            isAdmin: role === 'admin',
            isCustomer: role === 'customer',
          });
        } else {
          throw loginErr;
        }
      }
    } catch (err: any) {
      console.warn('Fallback a perfil demostrativo local de Taju:', err);
      const fallbackUser: UserProfile = {
        uid: role === 'admin' ? 'taju-admin-carlos' : 'taju-customer-valentina',
        email: role === 'admin' ? 'carlos.mendoza@taju.co' : 'valentina.rios@taju.co',
        displayName: role === 'admin' ? 'Carlos Mendoza' : 'Valentina Ríos',
        role,
        phone: role === 'customer' ? '+57 312 458 9021' : undefined,
        documentNumber: role === 'customer' ? 'CC •••• 7821' : undefined,
        loyaltyLevel: 'NIVEL GOLD',
        memberSince: 'Mar 2023',
        createdAt: new Date().toISOString(),
      };
      if (role === 'customer') {
        try {
          await initializeLoyaltyCardForCustomer(fallbackUser.uid, fallbackUser.email, fallbackUser.displayName, {
            documentNumber: 'CC •••• 7821',
            phone: '+57 312 ••• 9021',
          });
        } catch (_) {}
      }
      setAuthState({
        user: fallbackUser,
        loading: false,
        error: null,
        isAdmin: role === 'admin',
        isCustomer: role === 'customer',
      });
    } finally {
      setAuthActionLoading(false);
    }
  }, [handleLogin]);

  const handleResetPassword = useCallback(async (identifier: string, newPass: string) => {
    setAuthActionLoading(true);
    setAuthState((prev) => ({ ...prev, error: null }));
    try {
      const res = await resetOrSetCustomerPassword(identifier, newPass);
      return res;
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, error: err.message || 'Error al actualizar contraseña.' }));
      throw err;
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  const handleSendPasswordResetEmail = useCallback(async (email: string) => {
    setAuthActionLoading(true);
    setAuthState((prev) => ({ ...prev, error: null }));
    try {
      await sendResetPasswordEmail(email);
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, error: err.message || 'Error al enviar el correo de recuperación.' }));
      throw err;
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  return {
    ...authState,
    actionLoading: authActionLoading,
    login: handleLogin,
    register: handleRegister,
    loginWithGoogle: handleGoogleLogin,
    logout: handleLogout,
    quickDemoLogin: handleQuickDemoLogin,
    resetPassword: handleResetPassword,
    sendPasswordResetEmail: handleSendPasswordResetEmail,
  };
}
