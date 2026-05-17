export type ShiftStatus = "OPEN" | "CLOSED";

export type ShiftRecord = {
  id: string;
  status: ShiftStatus;
  openedByUid?: string;
  openedByEmail?: string;
  closedByUid?: string;
  closedByEmail?: string;
  openingCash: number;
  closingCashExpected?: number;
  closingCashActual?: number;
  variance?: number;
  cashSales?: number;
  qrisSales?: number;
  totalSales?: number;
  orderCount?: number;
  noteOpen?: string;
  noteClose?: string;
  openedAt?: any;
  closedAt?: any;
  updatedAt?: any;
};

export type ShiftOrderLike = {
  status?: string;
  total?: number;
  paymentMethod?: string | null;
  shiftId?: string | null;
};

export function normalizeShift(id: string, data: any): ShiftRecord {
  return {
    id,
    status: (data?.status || "OPEN") as ShiftStatus,
    openedByUid: data?.openedByUid || "",
    openedByEmail: data?.openedByEmail || "",
    closedByUid: data?.closedByUid || "",
    closedByEmail: data?.closedByEmail || "",
    openingCash: Number(data?.openingCash || 0),
    closingCashExpected: Number(data?.closingCashExpected || 0),
    closingCashActual: Number(data?.closingCashActual || 0),
    variance: Number(data?.variance || 0),
    cashSales: Number(data?.cashSales || 0),
    qrisSales: Number(data?.qrisSales || 0),
    totalSales: Number(data?.totalSales || 0),
    orderCount: Number(data?.orderCount || 0),
    noteOpen: (data?.noteOpen || "").toString(),
    noteClose: (data?.noteClose || "").toString(),
    openedAt: data?.openedAt,
    closedAt: data?.closedAt,
    updatedAt: data?.updatedAt,
  };
}

export function calculateShiftTotals(orders: ShiftOrderLike[], shiftId: string) {
  let cashSales = 0;
  let qrisSales = 0;
  let totalSales = 0;
  let orderCount = 0;

  for (const order of orders) {
    if ((order.status || "").toUpperCase() !== "PAID") continue;
    if ((order.shiftId || "") !== shiftId) continue;

    const total = Number(order.total || 0);
    totalSales += total;
    orderCount += 1;

    if ((order.paymentMethod || "").toUpperCase() === "CASH") cashSales += total;
    if ((order.paymentMethod || "").toUpperCase() === "QRIS") qrisSales += total;
  }

  return {
    cashSales,
    qrisSales,
    totalSales,
    orderCount,
  };
}

export function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

export function isShiftPermissionError(error: any) {
  const code = (error?.code || "").toString().toLowerCase();
  const message = (error?.message || "").toString().toLowerCase();

  return (
    code.includes("permission-denied") ||
    message.includes("missing or insufficient permissions")
  );
}
