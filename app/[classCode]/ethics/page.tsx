'use client'

import { useEffect, useState } from 'react'

interface Guideline {
  id: string
  title: string
  description: string
  category: string | null
  priority: number
}

interface Template {
  id: string
  template_type: string
  title_ko: string
  content_ko: string
  version: string
  is_active: boolean
  created_at: string
}

export default function EthicsPage() {
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addType, setAddType] = useState<'guideline' | 'template'>('guideline')
  const [guidelineForm, setGuidelineForm] = useState({ title: '', description: '', category: '', priority: 999 })
  const [templateForm, setTemplateForm] = useState({ templateType: 'behavior_contract', titleKo: '', contentKo: '', version: '1.0' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const fetchData = async () => {
    const res = await fetch('/api/ethics')
    const data = await res.json()
    setGuidelines(data.guidelines || [])
    setTemplates(data.templates || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    setMessage('')

    try {
      const body = addType === 'guideline'
        ? { type: 'guideline', ...guidelineForm }
        : { type: 'template', ...templateForm }

      const res = await fetch('/api/ethics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(`✅ ${addType === 'guideline' ? '윤리 가이드라인' : '동의서 템플릿'} 추가 완료`)
        setShowAddModal(false)
        setGuidelineForm({ title: '', description: '', category: '', priority: 999 })
        setTemplateForm({ templateType: 'behavior_contract', titleKo: '', contentKo: '', version: '1.0' })
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📜 PBS 윤리 및 동의서 관리</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          + 추가
        </button>
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* 윤리 가이드라인 */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">🔒 PBS 윤리 가이드라인 ({guidelines.length}개)</h2>
        {guidelines.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">등록된 윤리 가이드라인이 없습니다.</p>
            <button
              onClick={() => { setAddType('guideline'); setShowAddModal(true) }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              윤리 가이드라인 추가하기 →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {guidelines.map(g => (
              <div key={g.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-bold text-gray-900">{g.title}</p>
                  {g.category && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      {g.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{g.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 동의서 템플릿 */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">📄 동의서 템플릿 ({templates.length}개)</h2>
        {templates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">등록된 동의서 템플릿이 없습니다.</p>
            <button
              onClick={() => { setAddType('template'); setShowAddModal(true) }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              동의서 템플릿 추가하기 →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-blue-100 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900">{t.title_ko}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      유형: {t.template_type} · 버전: {t.version}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {t.is_active ? '활성' : '비활성'}
                  </span>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                    내용 보기
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                    {t.content_ko}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">
              {addType === 'guideline' ? '윤리 가이드라인 추가' : '동의서 템플릿 추가'}
            </h2>

            {/* 유형 선택 */}
            <div className="flex gap-2">
              <button
                onClick={() => setAddType('guideline')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  addType === 'guideline' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                윤리 가이드라인
              </button>
              <button
                onClick={() => setAddType('template')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  addType === 'template' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                동의서 템플릿
              </button>
            </div>

            {addType === 'guideline' ? (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">제목 *</span>
                  <input
                    type="text"
                    value={guidelineForm.title}
                    onChange={e => setGuidelineForm({ ...guidelineForm, title: e.target.value })}
                    placeholder="예: 최소 제한 원칙"
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">설명 *</span>
                  <textarea
                    value={guidelineForm.description}
                    onChange={e => setGuidelineForm({ ...guidelineForm, description: e.target.value })}
                    placeholder="윤리 가이드라인의 상세 내용"
                    rows={4}
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">카테고리</span>
                  <input
                    type="text"
                    value={guidelineForm.category}
                    onChange={e => setGuidelineForm({ ...guidelineForm, category: e.target.value })}
                    placeholder="예: 행동 중재, 데이터 보안"
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">템플릿 유형 *</span>
                  <select
                    value={templateForm.templateType}
                    onChange={e => setTemplateForm({ ...templateForm, templateType: e.target.value })}
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="behavior_contract">행동계약서</option>
                    <option value="response_cost">반응대가 동의서</option>
                    <option value="fba_consent">FBA 동의서</option>
                    <option value="data_privacy">개인정보 동의서</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">제목 *</span>
                  <input
                    type="text"
                    value={templateForm.titleKo}
                    onChange={e => setTemplateForm({ ...templateForm, titleKo: e.target.value })}
                    placeholder="예: 행동계약서 학부모 동의서"
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">내용 *</span>
                  <textarea
                    value={templateForm.contentKo}
                    onChange={e => setTemplateForm({ ...templateForm, contentKo: e.target.value })}
                    placeholder="동의서 전문 내용"
                    rows={8}
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">버전</span>
                  <input
                    type="text"
                    value={templateForm.version}
                    onChange={e => setTemplateForm({ ...templateForm, version: e.target.value })}
                    placeholder="1.0"
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
