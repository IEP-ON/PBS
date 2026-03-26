import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PBS 토큰 이코노미',
    short_name: 'PBS',
    description: '특수학급 PBS 긍정적 행동지원 토큰 이코노미 시스템',
    start_url: '/login',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    orientation: 'portrait-primary',
    lang: 'ko',
    categories: ['education'],
    icons: [
      { src: '/icon?size=192', sizes: '192x192', type: 'image/png' },
      { src: '/icon?size=512', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    shortcuts: [
      {
        name: 'ATM',
        url: '/atm',
        description: '학생 ATM 토큰 충전',
        icons: [{ src: '/icon?size=192', sizes: '192x192' }],
      },
    ],
  }
}
