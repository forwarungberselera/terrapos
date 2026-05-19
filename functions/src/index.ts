import {getApps, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {HttpsError, onCall} from "firebase-functions/v2/https";

setGlobalOptions({maxInstances: 10});

const adminApp = getApps().length ? getApps()[0] : initializeApp();
const db = getFirestore(adminApp);

type RefundOrderRequest = {
  tenantId?: string;
  orderId?: string;
  refundPin?: string;
  reason?: string;
};

type UpdateRefundPinRequest = {
  tenantId?: string;
  refundPin?: string;
};

/**
 * Validates that a value is a non-empty string.
 * @param {unknown} value - The value to validate.
 * @param {string} fieldName - The field name for error messages.
 * @return {string} The trimmed non-empty string.
 */
function mustNonEmptyString(value: unknown, fieldName: string): string {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!parsed) {
    throw new HttpsError("invalid-argument", `${fieldName} wajib diisi.`);
  }
  return parsed;
}

/**
 * Gets the tenant access context for a given user.
 * @param {string} tenantId - The tenant ID.
 * @param {string} uid - The user ID.
 * @return {Promise<object>} Access context with role info.
 */
async function getTenantAccessContext(tenantId: string, uid: string) {
  const tenantRef = db.doc(`tenants/${tenantId}`);
  const staffRef = db.doc(`tenants/${tenantId}/staff/${uid}`);
  const userRef = db.doc(`users/${uid}`);
  const [tenantSnap, staffSnap, userSnap] =
    await Promise.all([tenantRef.get(), staffRef.get(), userRef.get()]);

  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant tidak ditemukan.");
  }

  // Check developer status
  const userData = userSnap.exists ?
    userSnap.data() as {isDeveloper?: boolean} : undefined;
  const isDev = userData?.isDeveloper === true;

  const tenantData = tenantSnap.data() as {ownerUid?: string} | undefined;
  const isOwner = (tenantData?.ownerUid || "") === uid;

  let allowedRole = "";
  if (staffSnap.exists) {
    const staffData = staffSnap.data() as {role?: string};
    allowedRole = (staffData.role || "").toString().toLowerCase();
  }

  return {
    isOwner,
    isDeveloper: isDev,
    allowedRole,
    canRefund: isDev || isOwner ||
      allowedRole === "admin" || allowedRole === "owner",
  };
}

/**
 * Retrieves the saved refund PIN for a tenant.
 * @param {string} tenantId - The tenant ID.
 * @return {Promise<string>} The refund PIN or default.
 */
async function getSavedRefundPin(tenantId: string): Promise<string> {
  const privateSecurityRef = db.doc(`tenants/${tenantId}/private/security`);
  const settingsRef = db.doc(`tenants/${tenantId}/settings/main`);
  const [privateSecuritySnap, settingsSnap] = await Promise.all([
    privateSecurityRef.get(),
    settingsRef.get(),
  ]);

  const privateSecurityData =
    privateSecuritySnap.data() as {refundPin?: string} | undefined;
  const settingsData = settingsSnap.data() as {refundPin?: string} | undefined;

  return (
    (privateSecurityData?.refundPin || "").trim() ||
    (settingsData?.refundPin || "").trim() ||
    "123456"
  );
}

export const refundOrder = onCall<RefundOrderRequest>(async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "User harus login.");
  }

  const tenantId = mustNonEmptyString(request.data?.tenantId, "tenantId");
  const orderId = mustNonEmptyString(request.data?.orderId, "orderId");
  const refundPin = mustNonEmptyString(request.data?.refundPin, "refundPin");
  const reason =
    typeof request.data?.reason === "string" ? request.data.reason.trim() : "";

  const orderRef = db.doc(`tenants/${tenantId}/orders/${orderId}`);
  const refundsRef = db.collection(`tenants/${tenantId}/refunds`);

  const access = await getTenantAccessContext(tenantId, auth.uid);
  if (!access.canRefund) {
    throw new HttpsError(
      "permission-denied",
      "Hanya owner/admin yang bisa refund."
    );
  }

  const savedPin = await getSavedRefundPin(tenantId);
  if (savedPin !== refundPin) {
    throw new HttpsError("permission-denied", "PIN refund salah.");
  }

  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order tidak ditemukan.");
  }

  const orderData = orderSnap.data() as {
    orderNo?: string;
    status?: string;
    mode?: string | null;
    tableNo?: string | null;
    paymentMethod?: string | null;
    paidAmount?: number | null;
    subtotal?: number;
    discount?: number;
    total?: number;
    items?: unknown[];
    createdAt?: unknown;
    paidAt?: unknown;
  };

  if ((orderData.status || "").toUpperCase() !== "PAID") {
    throw new HttpsError(
      "failed-precondition",
      "Hanya order PAID yang bisa direfund."
    );
  }

  const refundRef = refundsRef.doc();
  const refundedByEmail =
    typeof auth.token.email === "string" ? auth.token.email : "";
  const refundedByRole = access.isOwner ?
    "owner" : access.allowedRole || "admin";

  const batch = db.batch();
  batch.set(refundRef, {
    orderId,
    orderNo: orderData.orderNo || orderId,
    statusBeforeRefund: orderData.status || "PAID",
    mode: orderData.mode || null,
    tableNo: orderData.tableNo ?? null,
    paymentMethod: orderData.paymentMethod ?? null,
    paidAmount: orderData.paidAmount ?? null,
    subtotal: Number(orderData.subtotal || 0),
    discount: Number(orderData.discount || 0),
    total: Number(orderData.total || 0),
    items: Array.isArray(orderData.items) ? orderData.items : [],
    originalCreatedAt: orderData.createdAt ?? null,
    originalPaidAt: orderData.paidAt ?? null,
    refundedAt: FieldValue.serverTimestamp(),
    refundedByUid: auth.uid,
    refundedByEmail,
    refundedByRole,
    reason,
  });
  batch.delete(orderRef);

  await batch.commit();

  return {
    ok: true,
    refundId: refundRef.id,
  };
});

// ============ DEVELOPER MODE ============

type SetDeveloperRequest = {
  targetUid?: string;
  targetEmail?: string;
  enabled?: boolean;
  secretKey?: string;
};

/**
 * Checks if a user is a developer.
 * @param {string} uid - The user ID.
 * @return {Promise<boolean>} Whether the user is a developer.
 */
async function checkIsDeveloperServer(uid: string): Promise<boolean> {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) return false;
  const data = userSnap.data() as {isDeveloper?: boolean} | undefined;
  return data?.isDeveloper === true;
}

/**
 * setDeveloper - Cloud Function untuk set/unset developer status.
 *
 * Keamanan: Hanya bisa dipanggil oleh:
 * 1. Existing developer (sudah isDeveloper: true)
 * 2. Atau dengan secretKey yang cocok (untuk bootstrap developer pertama)
 *
 * Secret key disimpan di environment variable DEVELOPER_SECRET_KEY
 * atau default "terrapos-dev-bootstrap-2024" untuk development.
 */
export const setDeveloper = onCall<SetDeveloperRequest>(async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "User harus login.");
  }

  const targetUid = typeof request.data?.targetUid === "string" ?
    request.data.targetUid.trim() : "";
  const targetEmail = typeof request.data?.targetEmail === "string" ?
    request.data.targetEmail.trim().toLowerCase() : "";
  const enabled = request.data?.enabled !== false; // default true
  const secretKey = typeof request.data?.secretKey === "string" ?
    request.data.secretKey.trim() : "";

  // Resolve target UID
  let resolvedUid = targetUid;

  if (!resolvedUid && targetEmail) {
    // Cari user by email
    const usersSnap = await db.collection("users")
      .where("email", "==", targetEmail).limit(1).get();
    if (usersSnap.empty) {
      throw new HttpsError("not-found",
        `User dengan email "${targetEmail}" tidak ditemukan.`);
    }
    resolvedUid = usersSnap.docs[0].id;
  }

  if (!resolvedUid) {
    throw new HttpsError("invalid-argument",
      "targetUid atau targetEmail wajib diisi.");
  }

  // Authorization check
  const callerIsDev = await checkIsDeveloperServer(auth.uid);
  const envSecret = process.env.DEVELOPER_SECRET_KEY ||
    "terrapos-dev-bootstrap-2024";

  if (!callerIsDev && secretKey !== envSecret) {
    throw new HttpsError("permission-denied",
      "Hanya developer existing atau secret key yang valid " +
      "yang bisa mengatur developer status.");
  }

  // Set developer status
  const userRef = db.doc(`users/${resolvedUid}`);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Target user tidak ditemukan.");
  }

  await userRef.set({
    isDeveloper: enabled,
    developerUpdatedAt: FieldValue.serverTimestamp(),
    developerUpdatedBy: auth.uid,
  }, {merge: true});

  const targetData = userSnap.data() as {email?: string} | undefined;

  return {
    ok: true,
    targetUid: resolvedUid,
    targetEmail: targetData?.email || targetEmail || "",
    isDeveloper: enabled,
  };
});

// ============ REFUND PIN ============

export const updateRefundPin =
  onCall<UpdateRefundPinRequest>(async (request) => {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new HttpsError("unauthenticated", "User harus login.");
    }

    const tenantId = mustNonEmptyString(request.data?.tenantId, "tenantId");
    const refundPin = mustNonEmptyString(request.data?.refundPin, "refundPin");

    if (refundPin.length < 6) {
      throw new HttpsError("invalid-argument", "PIN refund minimal 6 digit.");
    }

    const access = await getTenantAccessContext(tenantId, auth.uid);
    if (!access.isOwner && !access.isDeveloper) {
      throw new HttpsError(
        "permission-denied",
        "Hanya owner/developer yang bisa mengubah PIN refund."
      );
    }

    const privateSecurityRef = db.doc(`tenants/${tenantId}/private/security`);
    const settingsRef = db.doc(`tenants/${tenantId}/settings/main`);

    const batch = db.batch();
    batch.set(
      privateSecurityRef,
      {
        refundPin,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: auth.uid,
        updatedByEmail:
        typeof auth.token.email === "string" ? auth.token.email : "",
      },
      {merge: true}
    );
    batch.set(
      settingsRef,
      {
        refundPin: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    await batch.commit();

    return {
      ok: true,
    };
  });
