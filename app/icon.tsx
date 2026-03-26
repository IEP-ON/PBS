import { ImageResponse } from 'next/og'

export const contentType = 'image/png'

export default function Icon({ searchParams }: { searchParams?: Promise<{ size?: string }> }) {
  const size = 192
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: String(Math.round(size * 0.22)) + 'px',
        }}
      >
        <div style={{ fontSize: String(Math.round(size * 0.5)) + 'px', lineHeight: '1' }}>🏦</div>
        <div
          style={{
            color: 'white',
            fontSize: String(Math.round(size * 0.18)) + 'px',
            fontWeight: 700,
            marginTop: '4px',
            letterSpacing: '0.1em',
          }}
        >
          PBS
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
