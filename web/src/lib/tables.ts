/**
 * ===== MODEL DATA MEJA =====
 * Firestore collection: tenants/{tenantId}/tables
 *
 * Skema:
 * - number: string (nomor meja, e.g. "1", "2", "VIP-1")
 * - name: string (nama/label opsional, e.g. "Meja Depan")
 * - capacity: number (kapasitas orang)
 * - status: "available" | "occupied" | "reserved" | "inactive"
 * - currentOrderId: string | null (order aktif di meja ini)
 * - qrUrl: string (URL QR untuk customer scan)
 * - createdAt: Timestamp
 * - updatedAt: Timestamp
 */

export type TableStatus = "available" | "occupied" | "reserved" | "inactive";

export interface TableData {
  id: string;
  number: string;
  name: string;
  capacity: number;
  status: TableStatus;
  currentOrderId: string | null;
  qrUrl: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CustomerOrder {
  tableNumber: string;
  tableName: string;
  tenantId: string;
  items: CustomerOrderItem[];
  customerName?: string;
  customerNote?: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed";
  createdAt?: any;
}

export interface CustomerOrderItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

/**
 * Generate QR URL for a table
 */
export function generateTableQrUrl(
  origin: string,
  tenantId: string,
  tableNumber: string
): string {
  return `${origin}/menu/${tenantId}?table=${encodeURIComponent(tableNumber)}`;
}

/**
 * Status color mapping
 */
export function getStatusColor(status: TableStatus): string {
  switch (status) {
    case "available":
      return "#10b981";
    case "occupied":
      return "#ef4444";
    case "reserved":
      return "#f59e0b";
    case "inactive":
      return "#6b7280";
    default:
      return "#6b7280";
  }
}

/**
 * Status label (Bahasa Indonesia)
 */
export function getStatusLabel(status: TableStatus): string {
  switch (status) {
    case "available":
      return "Tersedia";
    case "occupied":
      return "Terisi";
    case "reserved":
      return "Dipesan";
    case "inactive":
      return "Nonaktif";
    default:
      return status;
  }
}
