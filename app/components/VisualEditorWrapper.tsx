"use client";

import dynamic from "next/dynamic";

const VisualEditor = dynamic(() => import("./VisualEditor"), { ssr: false });

export default function VisualEditorWrapper() {
  if (process.env.NODE_ENV !== "development") return null;
  return <VisualEditor />;
}
