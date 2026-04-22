export default function BankLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-lg px-4 py-8">{children}</div>
    </div>
  )
}
