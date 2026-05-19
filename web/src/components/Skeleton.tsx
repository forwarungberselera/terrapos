"use client";

import React from "react";

/**
 * Loading Skeleton Component
 * Bisa dipakai sebagai placeholder loading di seluruh app
 */

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
};

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

/**
 * Card Skeleton - untuk loading halaman
 */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        display: "grid",
        gap: 12,
      }}
    >
      <Skeleton width="40%" height={20} borderRadius={6} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i === rows - 1 ? "60%" : "100%"} height={14} borderRadius={6} />
      ))}
    </div>
  );
}

/**
 * Order Card Skeleton - untuk halaman orders
 */
export function OrderCardSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: 16,
        background: "#fff",
        display: "flex",
        gap: 16,
      }}
    >
      <div style={{ flex: 1, display: "grid", gap: 10 }}>
        <Skeleton width="50%" height={20} borderRadius={6} />
        <Skeleton width="80%" height={12} borderRadius={4} />
        <Skeleton width="60%" height={12} borderRadius={4} />
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <Skeleton width="100%" height={40} borderRadius={12} />
          <Skeleton width="100%" height={40} borderRadius={12} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 8, minWidth: 120, alignContent: "start" }}>
        <Skeleton width="100%" height={32} borderRadius={999} />
        <Skeleton width="100%" height={36} borderRadius={10} />
      </div>
    </div>
  );
}

/**
 * Page Loading Skeleton - full page loading state
 */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ display: "grid", gap: 14 }}>
        <CardSkeleton rows={2} />
        {Array.from({ length: cards }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

/**
 * Shimmer style injection - tambahkan di layout atau page
 */
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}
