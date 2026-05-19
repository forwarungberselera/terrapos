"use client";

import React from "react";

export default function TerraPage({
  children,
  maxWidth = 1200,
  noPadding = false,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  noPadding?: boolean;
}) {
  return (
    <>
      <style>{`
        .terra-page{
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--bg);
          transition: background 0.25s ease;
        }
        .terra-container{
          max-width: ${maxWidth}px;
          margin: 0 auto;
          padding: ${noPadding ? "0" : "16px"};
          padding-bottom: ${noPadding ? "0" : "calc(24px + var(--safe-bottom, 0px))"};
          animation: fadeIn 0.2s ease-out;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        @media (max-width: 768px) {
          .terra-container {
            padding: ${noPadding ? "0" : "12px"};
            padding-bottom: ${noPadding ? "0" : "calc(20px + var(--safe-bottom, 0px))"};
            gap: 12px;
          }
        }
      `}</style>
      <div className="terra-page">
        <div className="terra-container">
          {children}
        </div>
      </div>
    </>
  );
}
