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
          background: 'linear-gradient(135deg, #4FA3E8 0%, #1E2A44 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
          padding: '24px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '94px',
            height: '78px',
            borderRadius: '24px',
            background: '#ffffff',
            color: '#1E2A44',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '34px',
            fontWeight: 700,
            boxShadow: '0 16px 28px rgba(30, 42, 68, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '999px',
                  background: index === 1 ? '#F2C94C' : '#4FA3E8',
                }}
              />
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '-8px',
              left: '16px',
              width: '20px',
              height: '20px',
              background: '#ffffff',
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      </div>
    ),
    { width: 180, height: 180 }
  )
}
