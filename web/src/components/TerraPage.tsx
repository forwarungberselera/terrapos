"use client";

export default function TerraPage({
  children,
  maxWidth = 1200,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="container" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}