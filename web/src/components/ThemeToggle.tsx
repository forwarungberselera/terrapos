"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("terrapos_theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("terrapos_theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("terrapos_theme", "light");
    }
  }

  return (
    <button className="theme-toggle" onClick={toggle} title={dark ? "Light Mode" : "Dark Mode"}>
      {dark ? "\u2600" : "\u263D"}
    </button>
  );
}
