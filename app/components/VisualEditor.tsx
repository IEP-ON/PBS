"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface SelectedElement {
  tag: string;
  text: string;
  classes: string;
  html: string;
  path: string;
}

export default function VisualEditor() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const highlightRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const moveHighlight = useCallback((el: Element) => {
    if (!highlightRef.current) return;
    const rect = el.getBoundingClientRect();
    const h = highlightRef.current;
    h.style.top = `${rect.top + window.scrollY}px`;
    h.style.left = `${rect.left + window.scrollX}px`;
    h.style.width = `${rect.width}px`;
    h.style.height = `${rect.height}px`;
    h.style.display = "block";
  }, []);

  const hideHighlight = useCallback(() => {
    if (highlightRef.current) highlightRef.current.style.display = "none";
  }, []);

  useEffect(() => {
    if (!active) {
      hideHighlight();
      return;
    }

    const onMove = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        panelRef.current?.contains(target) ||
        highlightRef.current?.contains(target)
      )
        return;
      moveHighlight(target);
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        panelRef.current?.contains(target) ||
        highlightRef.current?.contains(target)
      )
        return;
      e.preventDefault();
      e.stopPropagation();

      // 소스 파일 힌트 (data-source 있으면 사용)
      const sourcePath =
        target.closest("[data-source]")?.getAttribute("data-source") ?? "";

      setSelected({
        tag: target.tagName.toLowerCase(),
        text: (target.textContent ?? "").trim().slice(0, 200),
        classes: target.className ?? "",
        html: target.outerHTML.slice(0, 500),
        path: sourcePath,
      });
      setPrompt("");
      setCopied(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("click", onClick, true);
      hideHighlight();
    };
  }, [active, moveHighlight, hideHighlight]);

  // 단축키 Alt+Shift+E
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === "E") setActive((v) => !v);
      if (e.key === "Escape") {
        setActive(false);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const buildClipboard = () => {
    const lines: string[] = [];
    lines.push("## Visual Edit 요청");
    if (selected?.path) lines.push(`파일: ${selected.path}`);
    lines.push(`태그: <${selected?.tag}>`);
    if (selected?.text) lines.push(`텍스트: "${selected.text}"`);
    if (selected?.classes) lines.push(`클래스: ${selected.classes}`);
    lines.push("");
    lines.push("HTML 스냅샷:");
    lines.push("```html");
    lines.push(selected?.html ?? "");
    lines.push("```");
    lines.push("");
    lines.push("수정 요청:");
    lines.push(prompt);
    return lines.join("\n");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildClipboard());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* 토글 버튼 */}
      <button
        onClick={() => {
          setActive((v) => !v);
          setSelected(null);
        }}
        title="Visual Editor (Alt+Shift+E)"
        className={`fixed bottom-4 right-4 z-[9999] w-10 h-10 rounded-full shadow-lg text-sm font-bold transition-colors ${
          active
            ? "bg-blue-600 text-white ring-2 ring-blue-300"
            : "bg-white text-gray-700 border border-gray-300"
        }`}
      >
        ✏️
      </button>

      {/* 호버 하이라이트 */}
      <div
        ref={highlightRef}
        className="pointer-events-none fixed z-[9998] outline outline-2 outline-blue-500 bg-blue-500/10 hidden"
        style={{ position: "absolute", top: 0, left: 0 }}
      />

      {/* 선택된 요소 패널 */}
      {selected && active && (
        <div
          ref={panelRef}
          className="fixed bottom-16 right-4 z-[9999] w-80 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 flex flex-col gap-3 text-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">Visual Edit</span>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 space-y-1">
            <div>
              <span className="text-gray-400">태그</span>{" "}
              <code className="text-blue-600">&lt;{selected.tag}&gt;</code>
            </div>
            {selected.path && (
              <div>
                <span className="text-gray-400">파일</span>{" "}
                <code className="text-green-600 break-all">{selected.path}</code>
              </div>
            )}
            {selected.text && (
              <div>
                <span className="text-gray-400">텍스트</span>{" "}
                <span className="text-gray-700">
                  &ldquo;{selected.text.slice(0, 60)}&rdquo;
                </span>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="어떻게 수정할까요? (예: 배경색을 빨간색으로 바꿔줘)"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) handleCopy();
            }}
          />

          <button
            onClick={handleCopy}
            disabled={!prompt.trim()}
            className={`w-full py-2 rounded-lg font-medium transition-colors ${
              copied
                ? "bg-green-500 text-white"
                : prompt.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {copied ? "✓ 클립보드에 복사됨" : "Claude Code에 붙여넣기용 복사 ⌘↵"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            복사 후 Claude Code 채팅에 붙여넣으세요
          </p>
        </div>
      )}
    </>
  );
}
