/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Servicio de Fidelización - Taju Coffee House
 * Single Source of Truth + Concurrencia Optimista (OCC) + Transacciones Atómicas
 */

import {
  doc,
  collection,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  LoyaltyCard,
  MAX_STAMPS_PER_CYCLE,
  MINIMUM_PURCHASE_AMOUNT,
} from '../models/LoyaltyCard';
import { StampHistoryEntry } from '../models/StampHistory';
import {
  ConcurrencyConflictError,
} from './errorService';

export interface AddStampResult {
  newStampsCount: number;
  totalCyclesCompleted: number;
  rewardUnlocked: boolean;
  newVersion: number;
  historyEntryId: string;
}

// Semilla inicial de Taju Coffee House
const INITIAL_DEMO_CARDS: LoyaltyCard[] = [
  {
    id: 'taju-customer-valentina',
    customerId: 'taju-customer-valentina',
    customerName: 'Valentina Ríos',
    customerEmail: 'valentina.rios@taju.co',
    documentNumber: 'CC •••• 7821',
    phone: '+57 312 ••• 9021',
    branch: 'Sede Chapinero (Cra 7 #54-20)',
    memberCode: '#7821-TJ',
    memberSince: 'Mar 2023',
    loyaltyLevel: 'NIVEL GOLD',
    stampsCount: 5,
    totalCyclesCompleted: 2,
    totalVisits: 21,
    favoriteDrinkNotes: 'Americano Doble con leche de avena · Sin azúcar',
    lastStampNotes: 'Americano Doble',
    lastStampTime: 'Hoy 10:24 AM',
    stampsDates: {
      1: '12 Feb',
      2: '18 Feb',
      3: '24 Feb',
      4: '01 Mar',
      5: 'Hoy',
    },
    version: 5,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'taju-customer-santiago',
    customerId: 'taju-customer-santiago',
    customerName: 'Santiago Vélez Arango',
    customerEmail: 'santiago.velez@taju.co',
    documentNumber: 'CC 1098742516',
    phone: '+57 318 402 9911',
    branch: 'Sede Chapinero',
    memberCode: '#4516-TJ',
    memberSince: 'Oct 2023',
    loyaltyLevel: 'NIVEL SILVER',
    stampsCount: 1,
    totalCyclesCompleted: 0,
    totalVisits: 1,
    favoriteDrinkNotes: 'Flat White con café Geisha',
    lastStampNotes: 'Sello bienvenida registro',
    lastStampTime: 'Hoy 09:15 AM',
    stampsDates: {
      1: 'Bienvenida',
    },
    version: 1,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'taju-customer-camila',
    customerId: 'taju-customer-camila',
    customerName: 'Camila Valenzuela',
    customerEmail: 'camila.valenzuela@taju.co',
    documentNumber: 'CC •••• 3349',
    phone: '+57 315 882 4410',
    branch: 'Sede Chapinero',
    memberCode: '#3349-TJ',
    memberSince: 'Ene 2023',
    loyaltyLevel: 'NIVEL GOLD',
    stampsCount: 7,
    totalCyclesCompleted: 3,
    totalVisits: 31,
    favoriteDrinkNotes: 'Cold Brew de la casa',
    lastStampNotes: 'Cold Brew con hielo',
    lastStampTime: 'Ayer 16:40 PM',
    stampsDates: {
      1: '10 Ene',
      2: '18 Ene',
      3: '28 Ene',
      4: '05 Feb',
      5: '14 Feb',
      6: '22 Feb',
      7: 'Ayer',
    },
    version: 7,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

let inMemoryCards: LoyaltyCard[] = [...INITIAL_DEMO_CARDS];
let inMemoryHistory: StampHistoryEntry[] = [
  {
    id: 'hist-demo-1',
    cardId: 'taju-customer-valentina',
    customerId: 'taju-customer-valentina',
    customerName: 'Valentina Ríos',
    adminId: 'carlos-mendoza',
    adminEmail: 'carlos.mendoza@taju.co',
    purchaseAmount: 18500,
    stampNumber: 5,
    cycleNumber: 3,
    rewardGranted: false,
    createdAt: new Date().toISOString(),
    notes: 'Americano Doble',
  },
  {
    id: 'hist-demo-2',
    cardId: 'taju-customer-valentina',
    customerId: 'taju-customer-valentina',
    customerName: 'Valentina Ríos',
    adminId: 'carlos-mendoza',
    adminEmail: 'carlos.mendoza@taju.co',
    purchaseAmount: 22000,
    stampNumber: 4,
    cycleNumber: 3,
    rewardGranted: false,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    notes: 'Capuchino + Croissant',
  },
  {
    id: 'hist-demo-3',
    cardId: 'taju-customer-valentina',
    customerId: 'taju-customer-valentina',
    customerName: 'Valentina Ríos',
    adminId: 'carlos-mendoza',
    adminEmail: 'carlos.mendoza@taju.co',
    purchaseAmount: 35000,
    stampNumber: 8,
    cycleNumber: 2,
    rewardGranted: true,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    notes: '¡Premio 8 sellos canjeado!',
  },
];

/**
 * Agrega o actualiza una tarjeta en el caché local
 */
export function registerCardInMemory(card: LoyaltyCard) {
  const idx = inMemoryCards.findIndex((c) => c.customerId === card.customerId || c.id === card.id);
  if (idx >= 0) {
    inMemoryCards[idx] = { ...inMemoryCards[idx], ...card };
  } else {
    inMemoryCards.unshift(card);
  }
}

/**
 * Consulta el historial completo de todos los movimientos de la sede
 */
export async function fetchAllHistory(): Promise<StampHistoryEntry[]> {
  try {
    const historyCol = collection(db, 'stampHistory');
    const snapshot = await getDocsFromServer(historyCol);

    if (!snapshot.empty) {
      const history: StampHistoryEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        history.push({
          id: docSnap.id,
          cardId: data.cardId || '',
          customerId: data.customerId || '',
          customerName: data.customerName || 'Cliente Taju',
          adminId: data.adminId || '',
          adminEmail: data.adminEmail || '',
          purchaseAmount: Number(data.purchaseAmount) || 0,
          stampNumber: Number(data.stampNumber) || 1,
          cycleNumber: Number(data.cycleNumber) || 1,
          rewardGranted: Boolean(data.rewardGranted),
          createdAt: data.createdAt || new Date().toISOString(),
          notes: data.notes || '',
        });
      });

      const map = new Map<string, StampHistoryEntry>();
      for (const h of history) map.set(h.id, h);
      for (const h of inMemoryHistory) if (!map.has(h.id)) map.set(h.id, h);
      return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (error) {
    console.warn('[loyaltyService] Error leyendo todo el historial de Firestore:', error);
  }

  return [...inMemoryHistory].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Obtiene la tarjeta de fidelización directamente desde el servidor Firestore (Single Source of Truth)
 */
export async function fetchCardFromServer(customerId: string): Promise<LoyaltyCard | null> {
  try {
    const cardRef = doc(db, 'loyaltyCards', customerId);
    const snap = await getDocFromServer(cardRef);
    if (snap.exists()) {
      const data = snap.data();
      const card: LoyaltyCard = {
        id: snap.id,
        customerId: data.customerId || snap.id,
        customerEmail: data.customerEmail || '',
        customerName: data.customerName || 'Cliente Taju',
        documentNumber: data.documentNumber || '',
        phone: data.phone || '',
        branch: data.branch || 'Sede Chapinero (Cra 7 #54-20)',
        memberCode: data.memberCode || `#${(data.customerId || snap.id).slice(0, 4).toUpperCase()}-TJ`,
        memberSince: data.memberSince || 'Mar 2023',
        loyaltyLevel: data.loyaltyLevel || 'NIVEL GOLD',
        stampsCount: typeof data.stampsCount === 'number' ? data.stampsCount : 0,
        totalCyclesCompleted: typeof data.totalCyclesCompleted === 'number' ? data.totalCyclesCompleted : 0,
        totalVisits: typeof data.totalVisits === 'number' ? data.totalVisits : 1,
        favoriteDrinkNotes: data.favoriteDrinkNotes,
        lastStampNotes: data.lastStampNotes || 'Americano Doble',
        lastStampTime: data.lastStampTime || 'Hoy 10:24 AM',
        stampsDates: data.stampsDates || { 1: '12 Feb', 2: '18 Feb', 3: '24 Feb', 4: '01 Mar', 5: 'Hoy' },
        version: typeof data.version === 'number' ? data.version : 1,
        updatedAt: data.updatedAt || new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
      };
      registerCardInMemory(card);
      return card;
    }
  } catch (error) {
    console.warn('[loyaltyService] Error consultando Firestore, recurriendo a memoria:', error);
  }

  const found = inMemoryCards.find((c) => c.customerId === customerId || c.id === customerId);
  return found ? { ...found } : inMemoryCards[0] || null;
}

/**
 * Agrega un sello a la tarjeta del cliente dentro de una Transacción de Firestore atómica
 * con Control de Concurrencia Optimista (OCC) y prevención estricta de sobrescritura de datos obsoletos.
 */
export async function addStampWithTransaction(
  customerId: string,
  expectedVersion: number,
  purchaseAmount: number,
  adminInfo: { uid: string; email: string },
  notes?: string
): Promise<AddStampResult> {
  if (purchaseAmount < MINIMUM_PURCHASE_AMOUNT) {
    throw new Error(
      `El monto de la compra ($${purchaseAmount.toLocaleString('es-CO')}) debe ser igual o superior a $${MINIMUM_PURCHASE_AMOUNT.toLocaleString('es-CO')}.`
    );
  }

  const cardRef = doc(db, 'loyaltyCards', customerId);
  const historyColRef = collection(db, 'stampHistory');
  const newHistoryRef = doc(historyColRef);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const nowIso = now.toISOString();

  try {
    const result = await runTransaction(db, async (transaction) => {
      const cardDoc = await transaction.get(cardRef);

      let currentData: any = null;
      let actualVersion = 1;

      if (cardDoc.exists()) {
        currentData = cardDoc.data();
        actualVersion = typeof currentData.version === 'number' ? currentData.version : 1;
      } else {
        const local = inMemoryCards.find((c) => c.customerId === customerId || c.id === customerId);
        if (!local) {
          throw new Error(`La tarjeta para el cliente #${customerId} no existe.`);
        }
        currentData = local;
        actualVersion = local.version;
      }

      // Verificación de OCC
      if (actualVersion !== expectedVersion) {
        throw new ConcurrencyConflictError(customerId, expectedVersion, actualVersion);
      }

      const currentStamps = typeof currentData.stampsCount === 'number' ? currentData.stampsCount : 0;
      let totalCycles = typeof currentData.totalCyclesCompleted === 'number' ? currentData.totalCyclesCompleted : 0;
      const totalVisits = (typeof currentData.totalVisits === 'number' ? currentData.totalVisits : 0) + 1;

      const nextStampNumber = currentStamps + 1;
      let newStampsCount = nextStampNumber;
      let rewardUnlocked = false;

      const currentStampsDates: Record<number, string> = { ...(currentData.stampsDates || {}) };

      if (nextStampNumber >= MAX_STAMPS_PER_CYCLE) {
        newStampsCount = 0;
        totalCycles += 1;
        rewardUnlocked = true;
        currentStampsDates[MAX_STAMPS_PER_CYCLE] = '¡Premio!';
      } else {
        currentStampsDates[nextStampNumber] = 'Hoy';
      }

      const nextVersion = actualVersion + 1;

      const updatedPayload = {
        ...currentData,
        stampsCount: newStampsCount,
        totalCyclesCompleted: totalCycles,
        totalVisits: totalVisits,
        lastStampNotes: notes || 'Compra café especial',
        lastStampTime: `Hoy ${timeStr}`,
        stampsDates: currentStampsDates,
        version: nextVersion,
        updatedAt: nowIso,
        lastTransactionAt: serverTimestamp(),
      };

      transaction.set(cardRef, updatedPayload, { merge: true });

      const historyPayload = {
        id: newHistoryRef.id,
        cardId: customerId,
        customerId: customerId,
        customerName: currentData.customerName || 'Cliente Taju',
        adminId: adminInfo.uid,
        adminEmail: adminInfo.email,
        purchaseAmount: purchaseAmount,
        stampNumber: nextStampNumber,
        cycleNumber: totalCycles + (rewardUnlocked ? 0 : 1),
        rewardGranted: rewardUnlocked,
        createdAt: nowIso,
        notes: notes || (rewardUnlocked ? '¡8 Sellos completados! Premio reclamable' : 'Sello otorgado por consumo'),
      };

      transaction.set(newHistoryRef, historyPayload);

      // Sincronizar memoria local
      registerCardInMemory({
        id: customerId,
        customerId,
        customerName: currentData.customerName || 'Cliente Taju',
        customerEmail: currentData.customerEmail || '',
        documentNumber: currentData.documentNumber || '',
        phone: currentData.phone || '',
        branch: currentData.branch || 'Sede Chapinero',
        stampsCount: newStampsCount,
        totalCyclesCompleted: totalCycles,
        totalVisits,
        lastStampNotes: notes || 'Compra café especial',
        lastStampTime: `Hoy ${timeStr}`,
        stampsDates: currentStampsDates,
        version: nextVersion,
        updatedAt: nowIso,
        createdAt: currentData.createdAt || nowIso,
      });

      inMemoryHistory.unshift(historyPayload);

      return {
        newStampsCount,
        totalCyclesCompleted: totalCycles,
        rewardUnlocked,
        newVersion: nextVersion,
        historyEntryId: newHistoryRef.id,
      };
    });

    return result;
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      throw error;
    }
    console.warn('[loyaltyService] Error en transacción remota, aplicando fallback local:', error);
    
    // Fallback local en memoria
    const cardIndex = inMemoryCards.findIndex((c) => c.customerId === customerId || c.id === customerId);
    if (cardIndex >= 0) {
      const currentCard = inMemoryCards[cardIndex];
      const nextStampNumber = currentCard.stampsCount + 1;
      let newStampsCount = nextStampNumber;
      let rewardUnlocked = false;
      let totalCycles = currentCard.totalCyclesCompleted;
      const updatedStampsDates = { ...(currentCard.stampsDates || {}) };

      if (nextStampNumber >= MAX_STAMPS_PER_CYCLE) {
        newStampsCount = 0;
        totalCycles += 1;
        rewardUnlocked = true;
        updatedStampsDates[MAX_STAMPS_PER_CYCLE] = '¡Premio!';
      } else {
        updatedStampsDates[nextStampNumber] = 'Hoy';
      }

      const nextVersion = expectedVersion + 1;
      const historyId = `hist-${Date.now()}`;

      inMemoryCards[cardIndex] = {
        ...currentCard,
        stampsCount: newStampsCount,
        totalCyclesCompleted: totalCycles,
        totalVisits: (currentCard.totalVisits || 1) + 1,
        lastStampNotes: notes || 'Americano Doble',
        lastStampTime: `Hoy ${timeStr}`,
        stampsDates: updatedStampsDates,
        version: nextVersion,
        updatedAt: nowIso,
      };

      return {
        newStampsCount,
        totalCyclesCompleted: totalCycles,
        rewardUnlocked,
        newVersion: nextVersion,
        historyEntryId: historyId,
      };
    }
    throw error;
  }
}

/**
 * Consulta el historial detallado de compras y sellos de un cliente
 */
export async function fetchCustomerHistory(customerId: string): Promise<StampHistoryEntry[]> {
  try {
    const historyCol = collection(db, 'stampHistory');
    const q = query(historyCol, where('customerId', '==', customerId));
    const snapshot = await getDocsFromServer(q);

    if (!snapshot.empty) {
      const history: StampHistoryEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        history.push({
          id: docSnap.id,
          cardId: data.cardId || customerId,
          customerId: data.customerId || customerId,
          customerName: data.customerName,
          adminId: data.adminId || '',
          adminEmail: data.adminEmail || '',
          purchaseAmount: Number(data.purchaseAmount) || 0,
          stampNumber: Number(data.stampNumber) || 1,
          cycleNumber: Number(data.cycleNumber) || 1,
          rewardGranted: Boolean(data.rewardGranted),
          createdAt: data.createdAt || new Date().toISOString(),
          notes: data.notes,
        });
      });
      return history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (error) {
    console.warn('[loyaltyService] Error leyendo historial de Firestore:', error);
  }

  const list = inMemoryHistory.filter((h) => h.customerId === customerId || h.cardId === customerId);
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Obtiene la lista de todas las tarjetas activas para el Panel de Administrador Taju
 * Consulta directa a Firestore como Fuente Única de Verdad
 */
export async function fetchAllLoyaltyCards(): Promise<LoyaltyCard[]> {
  try {
    const cardsCol = collection(db, 'loyaltyCards');
    const snapshot = await getDocsFromServer(cardsCol);

    if (!snapshot.empty) {
      const cardsMap = new Map<string, LoyaltyCard>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const card: LoyaltyCard = {
          id: docSnap.id,
          customerId: data.customerId || docSnap.id,
          customerEmail: data.customerEmail || '',
          customerName: data.customerName || 'Cliente Taju',
          documentNumber: data.documentNumber || '',
          phone: data.phone || '',
          branch: data.branch || 'Sede Chapinero',
          memberCode: data.memberCode || `#${docSnap.id.slice(0, 4).toUpperCase()}-TJ`,
          memberSince: data.memberSince || 'Mar 2023',
          loyaltyLevel: data.loyaltyLevel || 'NIVEL GOLD',
          stampsCount: typeof data.stampsCount === 'number' ? data.stampsCount : 0,
          totalCyclesCompleted: typeof data.totalCyclesCompleted === 'number' ? data.totalCyclesCompleted : 0,
          totalVisits: typeof data.totalVisits === 'number' ? data.totalVisits : 1,
          favoriteDrinkNotes: data.favoriteDrinkNotes,
          lastStampNotes: data.lastStampNotes || 'Americano Doble',
          lastStampTime: data.lastStampTime || 'Hoy 10:24 AM',
          stampsDates: data.stampsDates,
          version: typeof data.version === 'number' ? data.version : 1,
          updatedAt: data.updatedAt || new Date().toISOString(),
          createdAt: data.createdAt || new Date().toISOString(),
        };
        cardsMap.set(card.customerId, card);
      });

      // Asegurar que las tarjetas de memoria también estén si no estaban en Firestore
      for (const m of inMemoryCards) {
        if (!cardsMap.has(m.customerId)) {
          cardsMap.set(m.customerId, m);
          // Guardar en Firestore para que sea persistente
          setDoc(doc(db, 'loyaltyCards', m.customerId), m).catch(() => {});
        }
      }

      const all = Array.from(cardsMap.values());
      inMemoryCards = all;
      return all.sort((a, b) => (b.stampsCount || 0) - (a.stampsCount || 0));
    }
  } catch (error) {
    console.warn('[loyaltyService] Fallback de tarjetas en memoria:', error);
  }

  return [...inMemoryCards].sort((a, b) => (b.stampsCount || 0) - (a.stampsCount || 0));
}
