'use client'

import React from 'react'

const skeletonRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 2fr 1fr',
  gap: '12px',
  padding: '12px 0',
  borderBottom: '1px solid var(--border)',
}

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-alt) 25%, var(--border) 50%, var(--bg-alt) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  height: '12px',
  borderRadius: '999px',
}

export default function LoadingProductos() {
  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ ...shimmerStyle, width: 220, height: 20 }} />
        <div style={{ ...shimmerStyle, width: 120, height: 36 }} />
      </div>
      <div style={{ ...shimmerStyle, width: '100%', height: 42, marginBottom: 20 }} />
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', background: 'var(--card)' }}>
        {[...Array(6)].map((_, idx) => (
          <div key={idx} style={skeletonRowStyle}>
            <div style={{ ...shimmerStyle, width: '80%' }} />
            <div style={{ ...shimmerStyle, width: '90%' }} />
            <div style={{ ...shimmerStyle, width: '60%' }} />
          </div>
        ))}
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
