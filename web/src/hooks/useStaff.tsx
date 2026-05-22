"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import {
  StaffAccount,
  ActiveStaffSession,
  StaffRole,
  subscribeStaffAccounts,
  verifyStaffPin,
  setActiveStaffSession,
  getActiveStaffSession,
  clearActiveStaffSession,
  hasActiveStaff,
  migrateStaffSessionStorage,
} from "@/lib/staff-session";

/**
 * useStaff Hook
 * 
 * Provides:
 * - staffAccounts: list of all staff for this tenant
 * - activeStaff: currently logged-in staff (via PIN)
 * - loginStaff(staffId, pin): verify PIN and set active staff
 * - logoutStaff(): clear active staff (back to lock screen)
 * - isLocked: true if no staff is active (show PIN screen)
 * - staffEnabled: true if tenant has staff accounts set up
 * - loadingStaff: loading state
 */
export function useStaff() {
  const { tenantId } = useTenant();

  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [activeStaff, setActiveStaff] = useState<ActiveStaffSession | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [error, setError] = useState<string>("");

  // Load active staff from sessionStorage on mount
  // Staff session hilang saat tab/app ditutup → harus login PIN lagi
  useEffect(() => {
    // Migrasi: hapus sisa session dari localStorage (versi lama)
    migrateStaffSessionStorage();

    const saved = getActiveStaffSession();
    if (saved) {
      setActiveStaff(saved);
    }
    setLoadingStaff(false);
  }, []);

  // Subscribe to staff accounts from Firestore
  useEffect(() => {
    if (!tenantId) return;

    const unsub = subscribeStaffAccounts(tenantId, (accounts) => {
      setStaffAccounts(accounts.filter((a) => a.isActive));
    });

    return () => unsub();
  }, [tenantId]);

  /**
   * Login staff with PIN
   * Returns true if success, false if PIN wrong
   */
  const loginStaff = useCallback(
    async (staffId: string, pin: string): Promise<boolean> => {
      if (!tenantId) {
        setError("Tenant tidak ditemukan.");
        return false;
      }

      setError("");

      try {
        const staff = await verifyStaffPin(tenantId, staffId, pin);
        if (!staff) {
          setError("PIN salah.");
          return false;
        }

        const session: ActiveStaffSession = {
          staffId: staff.id,
          staffName: staff.name,
          staffRole: staff.role,
          loginAt: Date.now(),
        };

        setActiveStaffSession(session);
        setActiveStaff(session);
        return true;
      } catch (e: any) {
        setError(e?.message || "Gagal verifikasi PIN.");
        return false;
      }
    },
    [tenantId]
  );

  /**
   * Logout staff (lock screen)
   * Owner account tetap login di Firebase - hanya staff session yang di-clear
   */
  const logoutStaff = useCallback(() => {
    clearActiveStaffSession();
    setActiveStaff(null);
    setError("");
  }, []);

  /**
   * Quick switch - logout current staff tanpa full lock
   * Langsung ke PIN screen untuk staff lain
   */
  const switchStaff = useCallback(() => {
    clearActiveStaffSession();
    setActiveStaff(null);
    setError("");
  }, []);

  // Staff system is "enabled" if there are staff accounts configured
  const staffEnabled = staffAccounts.length > 0;

  // Locked = staff system enabled tapi belum ada yang login via PIN
  const isLocked = staffEnabled && !activeStaff;

  return {
    staffAccounts,
    activeStaff,
    loadingStaff,
    error,
    staffEnabled,
    isLocked,
    loginStaff,
    logoutStaff,
    switchStaff,
  };
}
