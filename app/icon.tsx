import { ImageResponse } from 'next/og'

export const contentType = 'image/png'

export default async function Icon({ searchParams }: { searchParams?: Promise<{ size?: string }> }) {
  const params = (await searchParams) ?? {}
  const requestedSize = Number(params.size ?? '192')
  const size = Number.isFinite(requestedSize) && requestedSize > 0 ? requestedSize : 192

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #4FA3E8 0%, #1E2A44 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: String(Math.round(size * 0.22)) + 'px',
          padding: String(Math.round(size * 0.14)) + 'px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: String(Math.round(size * 0.52)) + 'px',
            height: String(Math.round(size * 0.42)) + 'px',
            borderRadius: String(Math.round(size * 0.12)) + 'px',
            background: '#ffffff',
            color: '#1E2A44',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: String(Math.round(size * 0.18)) + 'px',
            fontWeight: 700,
            boxShadow: '0 16px 28px rgba(30, 42, 68, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: String(Math.round(size * 0.035)) + 'px',
            }}
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  width: String(Math.round(size * 0.06)) + 'px',
                  height: String(Math.round(size * 0.06)) + 'px',
                  borderRadius: '999px',
                  background: index === 1 ? '#F2C94C' : '#4FA3E8',
                }}
              />
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: String(Math.round(size * -0.045)) + 'px',
              left: String(Math.round(size * 0.08)) + 'px',
              width: String(Math.round(size * 0.12)) + 'px',
              height: String(Math.round(size * 0.12)) + 'px',
              background: '#ffffff',
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
