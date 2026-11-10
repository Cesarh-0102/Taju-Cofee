/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Servicio de Autenticación y Gestión de Clientes - Taju Coffee House
 * Sincronización directa con Firebase Firestore como Fuente Única de Verdad
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  setDoc,
  collection,
  query,
  where,
  getDocsFromServer,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole } from '../models/User';
import { registerCardInMemory } from './loyaltyService';

// Email del administrador designado en el entorno
const BOOTSTRAP_ADMIN_EMAIL = 'instructorcesarh@gmail.com';

export interface CustomerRegistrationPayload {
  email: string;
  name: string;
  password?: string;
  documentType?: string;
  documentNumber?: string;
  phone?: string;
  birthdayDay?: string | number;
  birthdayMonth?: string;
  grantWelcomeStamp?: boolean;
}

/**
 * Obtiene o inicializa el perfil del usuario directamente desde Firestore.
 */
export async function getOrCreateUserProfile(firebaseUser: FirebaseUser): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  
  try {
    const userSnapshot = await getDocFromServer(userDocRef);
    const isAdminEmail = firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    if (userSnapshot.exists()) {
      const data = userSnapshot.data();
      const role: UserRole = (isAdminEmail || data.role === 'admin') ? 'admin' : 'customer';

      if (role === 'admin') {
        await ensureAdminDoc(firebaseUser.uid, firebaseUser.email || '');
      }

      return {
        uid: firebaseUser.uid,
        email: data.email || firebaseUser.email || '',
        displayName: data.displayName || firebaseUser.displayName || 'Cliente Taju',
        role,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        phone: data.phone,
        loyaltyLevel: data.loyaltyLevel || 'NIVEL GOLD',
        memberSince: data.memberSince || 'Mar 2023',
        createdAt: data.createdAt || new Date().toISOString(),
      };
    } else {
      const role: UserRole = isAdminEmail ? 'admin' : 'customer';
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || (role === 'admin' ? 'Carlos Mendoza' : 'Valentina Ríos'),
        role,
        loyaltyLevel: 'NIVEL GOLD',
        memberSince: 'Mar 2023',
        createdAt: new Date().toISOString(),
      };

      await setDoc(userDocRef, newProfile);

      if (role === 'admin') {
        await ensureAdminDoc(firebaseUser.uid, firebaseUser.email || '');
      } else {
        await initializeLoyaltyCardForCustomer(
          newProfile.uid,
          newProfile.email,
          newProfile.displayName
        );
      }

      return newProfile;
    }
  } catch (error) {
    console.warn('[authService] Error leyendo perfil, usando datos de auth:', error);
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'Usuario Taju',
      role: 'customer',
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Garantiza que el documento en /admins/{uid} exista
 */
async function ensureAdminDoc(uid: string, email: string): Promise<void> {
  try {
    const adminDocRef = doc(db, 'admins', uid);
    await setDoc(
      adminDocRef,
      {
        email,
        assignedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('[AuthService] No se pudo escribir en /admins:', e);
  }
}

/**
 * Inicializa la tarjeta de fidelización digital en Firestore
 */
export async function initializeLoyaltyCardForCustomer(
  customerId: string,
  customerEmail: string,
  customerName: string,
  options?: {
    documentNumber?: string;
    phone?: string;
    grantWelcomeStamp?: boolean;
    birthdayDay?: string | number;
    birthdayMonth?: string;
  }
): Promise<void> {
  const cardRef = doc(db, 'loyaltyCards', customerId);
  const initialStamps = options?.grantWelcomeStamp ? 1 : 0;
  const stampsDates: Record<number, string> = {};
  if (initialStamps === 1) {
    stampsDates[1] = 'Bienvenida';
  }

  const cleanDoc = options?.documentNumber || 'CC •••• 7821';
  const shortCode = cleanDoc.replace(/\D/g, '').slice(-4) || customerId.slice(0, 4).toUpperCase();

  const cardPayload = {
    id: customerId,
    customerId,
    customerEmail,
    customerName,
    documentNumber: cleanDoc,
    phone: options?.phone || '+57 312 ••• 9021',
    branch: 'Sede Chapinero (Cra 7 #54-20)',
    memberCode: `#${shortCode}-TJ`,
    memberSince: 'Mar 2023',
    loyaltyLevel: 'NIVEL GOLD',
    stampsCount: initialStamps,
    totalCyclesCompleted: 0,
    totalVisits: initialStamps,
    stampsDates,
    version: 1, // OCC inicial
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Guardar inmediatamente en memoria para sincronización instantánea en UI
  registerCardInMemory(cardPayload as any);

  try {
    await setDoc(cardRef, cardPayload, { merge: true });
    console.log('[AuthService] Tarjeta creada en Firestore:', customerId);
  } catch (error) {
    console.error('[AuthService] Error creando tarjeta en Firestore:', error);
  }
}

/**
 * Registro de cliente desde el POS o desde la web
 * Crea directamente el registro en Firestore sin depender de proveedores de autenticación restringidos
 */
export async function registerCustomer(payload: CustomerRegistrationPayload): Promise<UserProfile> {
  const {
    email,
    password = 'TajuCoffee2026!',
    name,
    documentType = 'Cédula C.C.',
    documentNumber = '',
    phone = '',
    birthdayDay,
    birthdayMonth,
    grantWelcomeStamp = false,
  } = payload;

  // Generar ID único para el cliente en Firestore
  const cleanDocDigits = documentNumber.replace(/\D/g, '');
  const customerId = cleanDocDigits
    ? `cust_${cleanDocDigits}`
    : `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const customerEmail = email.trim() || `cliente.${cleanDocDigits || customerId}@taju.co`;

  // Intentar crear en Firebase Auth si no hay usuario activo y el proveedor está disponible
  let createdFirebaseUid: string | null = null;
  if (!auth.currentUser) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, customerEmail, password);
      createdFirebaseUid = userCredential.user.uid;
    } catch (authErr: any) {
      // Si Firebase Auth arroja operation-not-allowed porque Email/Password no está habilitado en GCP console,
      // continuamos guardando el cliente directamente en Firestore (Single Source of Truth)
      console.warn('[registerCustomer] Auth provider no habilitado, registrando directamente en Firestore:', authErr.code);
    }
  }

  const finalUid = createdFirebaseUid || customerId;

  const finalPassword = (password && password.trim()) || '2026Taju';

  const profile: UserProfile = {
    uid: finalUid,
    email: customerEmail,
    displayName: name.trim() || 'Cliente Taju',
    role: 'customer',
    documentType,
    documentNumber: documentNumber ? `${documentType.includes('C.C.') ? 'CC' : 'DOC'} ${documentNumber}` : 'CC •••• 7821',
    phone: phone.trim() || '+57 312 ••• 9021',
    birthdayDay,
    birthdayMonth,
    loyaltyLevel: 'NIVEL GOLD',
    memberSince: 'Mar 2023',
    password: finalPassword,
    createdAt: new Date().toISOString(),
  };

  // Guardar en Firestore colección 'users'
  try {
    await setDoc(doc(db, 'users', finalUid), profile, { merge: true });
  } catch (err) {
    console.error('[registerCustomer] Error guardando usuario en Firestore:', err);
  }

  // Guardar en Firestore colección 'loyaltyCards'
  await initializeLoyaltyCardForCustomer(finalUid, profile.email, profile.displayName, {
    documentNumber: profile.documentNumber,
    phone: profile.phone,
    grantWelcomeStamp,
    birthdayDay,
    birthdayMonth,
  });

  return profile;
}

/**
 * Inicio de sesión con Email y Contraseña (con búsqueda en Firestore si Auth provider está deshabilitado)
 */
// Credenciales Oficiales de Administrador - Taju Coffee House
export const ADMIN_USERNAME = 'CajaTaju';
export const ADMIN_PASSWORD = '2026Taju';
export const ADMIN_EMAIL = 'cajataju@taju.co';

/**
 * Inicio de sesión unificado - Taju Coffee House
 * - Si es admin (usuario: CajaTaju, clave: 2026Taju), redirige a Panel Admin
 * - Si es cliente (cédula, correo o teléfono con su clave), redirige a Panel Cliente
 */
export async function loginWithEmail(identifier: string, pass: string): Promise<UserProfile> {
  const cleanId = (identifier || '').trim();
  const cleanPass = (pass || '').trim();
  const lowerId = cleanId.toLowerCase();

  if (!cleanId || !cleanPass) {
    throw new Error('Por favor ingresa tu usuario/cédula y contraseña.');
  }

  // 1. Detección de Usuario Administrador (CajaTaju / 2026Taju)
  const isAdminIdentifier =
    lowerId === 'cajataju' ||
    lowerId === 'cajataju@taju.co' ||
    lowerId === 'admin' ||
    lowerId === 'carlos' ||
    lowerId === 'carlos.mendoza@taju.co' ||
    lowerId === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  if (isAdminIdentifier) {
    if (cleanPass !== ADMIN_PASSWORD) {
      throw new Error('Contraseña incorrecta para el usuario administrador CajaTaju.');
    }

    const adminProfile: UserProfile = {
      uid: 'taju-admin-caja',
      email: ADMIN_EMAIL,
      displayName: 'Caja Taju (Administrador)',
      role: 'admin',
      loyaltyLevel: 'ADMINISTRADOR',
      createdAt: new Date().toISOString(),
    };

    // Asegurar registro de admin en Firestore
    ensureAdminDoc(adminProfile.uid, adminProfile.email).catch(() => {});
    setDoc(doc(db, 'users', adminProfile.uid), adminProfile, { merge: true }).catch(() => {});

    return adminProfile;
  }

  // 2. Detección de Cliente Regular (Cédula, Correo, Teléfono o ID)
  const digits = cleanId.replace(/\D/g, '');

  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocsFromServer(usersCol);
    let matchedDoc: any = null;
    let matchedUid: string | null = null;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const uEmail = (data.email || '').toLowerCase();
      const uDocNum = (data.documentNumber || '').replace(/\D/g, '');
      const uPhone = (data.phone || '').replace(/\D/g, '');
      const uName = (data.displayName || '').toLowerCase();
      const docId = docSnap.id.toLowerCase();

      if (
        uEmail === lowerId ||
        docId === lowerId ||
        (digits.length >= 4 && uDocNum.includes(digits)) ||
        (digits.length >= 6 && uPhone.includes(digits)) ||
        (lowerId.length >= 3 && uName.includes(lowerId))
      ) {
        matchedDoc = data;
        matchedUid = docSnap.id;
      }
    });

    if (matchedDoc && matchedUid) {
      // Verificar contraseña asignada
      if (matchedDoc.password) {
        if (matchedDoc.password !== cleanPass) {
          throw new Error('Contraseña incorrecta. Haz clic en "¿Olvidaste o deseas establecer tu contraseña?" para cambiarla.');
        }
      } else {
        // Si aún no tenía contraseña guardada, asociarle la que ingresó para siguientes inicios
        setDoc(doc(db, 'users', matchedUid), { password: cleanPass }, { merge: true }).catch(() => {});
      }

      return {
        uid: matchedUid,
        email: matchedDoc.email || cleanId,
        displayName: matchedDoc.displayName || 'Cliente Taju',
        role: 'customer',
        documentType: matchedDoc.documentType,
        documentNumber: matchedDoc.documentNumber,
        phone: matchedDoc.phone,
        loyaltyLevel: matchedDoc.loyaltyLevel || 'NIVEL GOLD',
        memberSince: matchedDoc.memberSince || 'Mar 2023',
        password: cleanPass,
        createdAt: matchedDoc.createdAt || new Date().toISOString(),
      };
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Contraseña incorrecta')) {
      throw err;
    }
    console.warn('[loginWithEmail] Error consultando Firestore:', err);
  }

  // 3. Clientes Demo iniciales de muestra (Valentina, Santiago, Camila)
  if (lowerId.includes('valentina') || digits.includes('7821')) {
    const valProfile: UserProfile = {
      uid: 'taju-customer-valentina',
      email: 'valentina.rios@taju.co',
      displayName: 'Valentina Ríos',
      role: 'customer',
      documentNumber: 'CC •••• 7821',
      phone: '+57 312 ••• 9021',
      loyaltyLevel: 'NIVEL GOLD',
      memberSince: 'Mar 2023',
      password: cleanPass,
      createdAt: new Date().toISOString(),
    };
    setDoc(doc(db, 'users', valProfile.uid), valProfile, { merge: true }).catch(() => {});
    return valProfile;
  }

  if (lowerId.includes('santiago') || digits.includes('1098742516') || digits.includes('4516')) {
    const santProfile: UserProfile = {
      uid: 'taju-customer-santiago',
      email: 'santiago.velez@taju.co',
      displayName: 'Santiago Vélez Arango',
      role: 'customer',
      documentNumber: 'CC 1098742516',
      phone: '+57 318 402 9911',
      loyaltyLevel: 'NIVEL SILVER',
      memberSince: 'Oct 2023',
      password: cleanPass,
      createdAt: new Date().toISOString(),
    };
    setDoc(doc(db, 'users', santProfile.uid), santProfile, { merge: true }).catch(() => {});
    return santProfile;
  }

  if (lowerId.includes('camila') || digits.includes('3349')) {
    const camProfile: UserProfile = {
      uid: 'taju-customer-camila',
      email: 'camila.valenzuela@taju.co',
      displayName: 'Camila Valenzuela',
      role: 'customer',
      documentNumber: 'CC •••• 3349',
      phone: '+57 315 882 4410',
      loyaltyLevel: 'NIVEL GOLD',
      memberSince: 'Ene 2023',
      password: cleanPass,
      createdAt: new Date().toISOString(),
    };
    setDoc(doc(db, 'users', camProfile.uid), camProfile, { merge: true }).catch(() => {});
    return camProfile;
  }

  throw new Error(`No se encontró ningún cliente registrado con el identificador "${cleanId}". Por favor regístrate en caja o verifica tus datos.`);
}

/**
 * Permite a un cliente establecer o cambiar su contraseña desde el Login
 */
export async function resetOrSetCustomerPassword(
  identifier: string,
  newPassword: string
): Promise<{ success: boolean; customerName: string; email: string }> {
  if (!identifier || !identifier.trim()) {
    throw new Error('Por favor ingresa tu número de cédula, correo o teléfono.');
  }
  if (!newPassword || newPassword.trim().length < 4) {
    throw new Error('La contraseña debe tener al menos 4 caracteres.');
  }

  const cleanId = identifier.trim().toLowerCase();
  const digits = cleanId.replace(/\D/g, '');

  if (cleanId === 'cajataju' || cleanId === 'admin') {
    throw new Error('La contraseña del usuario administrador CajaTaju es fija (2026Taju).');
  }

  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocsFromServer(usersCol);
    let matchedDocId: string | null = null;
    let matchedName = 'Cliente Taju';
    let matchedEmail = '';

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const userEmail = (data.email || '').toLowerCase();
      const userDocNum = (data.documentNumber || '').replace(/\D/g, '');
      const userPhone = (data.phone || '').replace(/\D/g, '');
      const userName = (data.displayName || '').toLowerCase();
      const docId = docSnap.id.toLowerCase();

      if (
        userEmail === cleanId ||
        docId === cleanId ||
        (digits.length >= 4 && userDocNum.includes(digits)) ||
        (digits.length >= 6 && userPhone.includes(digits)) ||
        (cleanId.length >= 3 && userName.includes(cleanId))
      ) {
        matchedDocId = docSnap.id;
        matchedName = data.displayName || 'Cliente Taju';
        matchedEmail = data.email || '';
      }
    });

    if (matchedDocId) {
      const updateData = {
        password: newPassword.trim(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', matchedDocId), updateData, { merge: true });
      await setDoc(doc(db, 'loyaltyCards', matchedDocId), updateData, { merge: true });

      return {
        success: true,
        customerName: matchedName,
        email: matchedEmail || cleanId,
      };
    }
  } catch (err: any) {
    console.warn('[resetOrSetCustomerPassword] Error en Firestore:', err);
  }

  // Búsqueda en demos
  if (cleanId.includes('valentina') || digits.includes('7821')) {
    const valDocId = 'taju-customer-valentina';
    await setDoc(doc(db, 'users', valDocId), { password: newPassword.trim(), updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true, customerName: 'Valentina Ríos', email: 'valentina.rios@taju.co' };
  }
  if (cleanId.includes('santiago') || digits.includes('1098742516') || digits.includes('4516')) {
    const santDocId = 'taju-customer-santiago';
    await setDoc(doc(db, 'users', santDocId), { password: newPassword.trim(), updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true, customerName: 'Santiago Vélez Arango', email: 'santiago.velez@taju.co' };
  }
  if (cleanId.includes('camila') || digits.includes('3349')) {
    const camDocId = 'taju-customer-camila';
    await setDoc(doc(db, 'users', camDocId), { password: newPassword.trim(), updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true, customerName: 'Camila Valenzuela', email: 'camila.valenzuela@taju.co' };
  }

  throw new Error(`No se encontró ningún cliente registrado con el documento o correo "${identifier}".`);
}

/**
 * Envío de correo de recuperación de contraseña utilizando Firebase Authentication (sendPasswordResetEmail)
 * Traduce códigos de error de Firebase a mensajes amigables en español.
 */
export async function sendResetPasswordEmail(email: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();

  // Validaciones previas
  if (!cleanEmail) {
    throw new Error('Por favor ingresa tu correo electrónico.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('El formato del correo electrónico no es válido.');
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error: any) {
    console.warn('[sendResetPasswordEmail] Error de Firebase Auth:', error.code, error.message);

    // Mapeo amigable de errores específicos de Firebase Auth en español
    switch (error.code) {
      case 'auth/user-not-found':
        throw new Error('No hay ningún usuario registrado con este correo electrónico.');
      case 'auth/invalid-email':
        throw new Error('El formato del correo electrónico ingresado no es válido.');
      case 'auth/too-many-requests':
        throw new Error('Demasiados intentos consecutivos. Por favor espera unos minutos antes de volver a intentar.');
      case 'auth/network-request-failed':
        throw new Error('Error de conexión a internet. Verifica tu red e inténtalo de nuevo.');
      case 'auth/missing-email':
        throw new Error('Por favor proporciona un correo electrónico válido.');
      case 'auth/operation-not-allowed':
        throw new Error('El servicio de recuperación por correo electrónico no está habilitado actualmente.');
      default:
        throw new Error(error.message || 'Ocurrió un error al enviar el correo de recuperación.');
    }
  }
}

/**
 * Inicio de sesión con Google (Popup)
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  return getOrCreateUserProfile(userCredential.user);
}

/**
 * Cierre de sesión seguro
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (_) {}
}

/**
 * Escucha cambios en el estado de autenticación de Firebase
 */
export function subscribeToAuthChanges(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
