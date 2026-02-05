'use client'

import React from 'react'

const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-alt) 25%, var(--border) 50%, var(--bg-alt) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: 12,
}

export default function LoadingCaja() {
  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ ...shimmer, height: 24, width: 220, marginBottom: 12 }} />
          <div style={{ ...shimmer, height: 14, width: '60%', marginBottom: 20 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[...Array(8)].map((_, idx) => (
              <div key={idx} style={{ ...shimmer, height: 90 }} />
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ ...shimmer, height: 18, width: '80%', marginBottom: 12 }} />
          <div style={{ ...shimmer, height: 18, width: '70%', marginBottom: 12 }} />
          <div style={{ ...shimmer, height: 18, width: '60%' }} />
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
