import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius: '40px',
        }}
      >
        <div style={{ fontSize: '90px', lineHeight: '1' }}>🏦</div>
        <div
          style={{
            color: 'white',
            fontSize: '32px',
            fontWeight: 700,
            marginTop: '4px',
            letterSpacing: '0.1em',
          }}
        >
          PBS
        </div>
      </div>
    ),
    { width: 180, height: 180 }
  )
}
