import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '말로 모으는 하루',
    short_name: '말모하',
    description: '말 일기와 통합학급 연계를 중심으로 운영하는 특수학급 지원 플랫폼',
    start_url: '/login',
    display: 'standalone',
    background_color: '#FAF7F0',
    theme_color: '#4FA3E8',
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
      {
        name: '말 일기장',
        url: '/diary-kiosk',
        description: '학생 말 일기 녹음 키오스크',
        icons: [{ src: '/icon?size=192', sizes: '192x192' }],
      },
    ],
  }
}
