"use client";

import React from "react";
import MobileSheet from "./MobileSheet";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "default";
  loading?: boolean;
};

/**
 * ConfirmDialog: Menggantikan window.confirm() dengan dialog yang mobile-friendly.
 * Di mobile: tampil sebagai bottom sheet
 * Di desktop: tampil sebagai centered modal
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Konfirmasi",
  message,
  confirmText = "Ya",
  cancelText = "Batal",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  const btnClass =
    variant === "danger"
      ? "btn btn-danger"
      : variant === "primary"
        ? "btn btn-primary"
        : "btn btn-primary";

  return (
    <MobileSheet open={open} onClose={onClose} title={title} maxHeight="50vh">
      <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
        {message}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button
          className="btn"
          style={{ flex: 1 }}
          onClick={onClose}
          disabled={loading}
        >
          {cancelText}
        </button>
        <button
          className={btnClass}
          style={{ flex: 1 }}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Memproses..." : confirmText}
        </button>
      </div>
    </MobileSheet>
  );
}
