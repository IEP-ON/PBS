import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* 로고 영역 */}
        <div className="space-y-2">
          <div className="text-6xl">🏦</div>
          <h1 className="text-3xl font-bold text-gray-900">PBS 토큰 이코노미</h1>
          <p className="text-gray-500 text-sm">긍정적 행동지원 기반 화폐·금융 시스템</p>
        </div>

        {/* 버튼 영역 */}
        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-2xl transition-colors shadow-lg shadow-blue-200"
          >
            로그인
          </Link>

          <Link
            href="/register"
            className="block w-full py-4 px-6 bg-white hover:bg-gray-50 text-blue-600 text-lg font-semibold rounded-2xl transition-colors border-2 border-blue-200"
          >
            새 학급 개설
          </Link>

          <Link
            href="/atm"
            className="block w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-2xl transition-colors"
          >
            🏧 ATM 모드
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          특수학급 PBS 중재를 위한 AI 기반 행동지원 플랫폼
        </p>
      </div>
    </div>
  );
}
