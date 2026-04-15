import { redirect } from 'next/navigation'

export default async function BehaviorAnalysisPage({
  params,
}: {
  params: Promise<{ classCode: string }>
}) {
  const { classCode } = await params
  redirect(`/${classCode}/support`)
}
