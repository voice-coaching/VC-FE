"use client";

// 화면 전체를 불러오는 동안 앱 영역을 밝게 덮고 브랜드 색 로딩 인디케이터를 띄운다.
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[var(--app-shell-width,402px)] -translate-x-1/2 flex-col items-center justify-center bg-[#f2f4f6]/85 backdrop-blur-sm"
    >
      <svg
        viewBox="0 0 50 50"
        className="loading-ring size-10"
        aria-hidden="true"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#6346f6"
          strokeWidth="5.5"
          strokeLinecap="round"
          className="loading-ring-arc"
        />
      </svg>
      {label ? (
        <p className="mt-4 text-sm font-medium text-[#4e5968]">{label}</p>
      ) : (
        <span className="sr-only">불러오는 중</span>
      )}
    </div>
  );
}
