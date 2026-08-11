'use client';

import { useSearchParams } from 'next/navigation';
import { ShieldAlert, AlertOctagon, HelpCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import { useState, Suspense } from 'react';
import '@/app/globals.css';

function BlockedContent() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get('url') || 'https://phishing-portal.net/verify-login';
  const source = searchParams.get('source') || 'VirusTotal';
  const score = parseInt(searchParams.get('score') || '92');
  const threatType = searchParams.get('type') || 'Phishing / Credential Harvesting';
  const cacheId = searchParams.get('cache_id') || 'TC-8849204';
  
  const [reported, setReported] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  const handleReport = async () => {
    setIsReporting(true);
    // Simulate sending a report to SOC
    await new Promise(resolve => setTimeout(resolve, 1500));
    setReported(true);
    setIsReporting(false);
  };

  return (
    <div style={{
      maxWidth: '560px',
      width: '100%',
      background: 'rgba(22, 10, 10, 0.65)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      borderRadius: '16px',
      padding: '40px',
      textAlign: 'center',
      boxShadow: '0 0 40px rgba(239, 68, 68, 0.1)',
      position: 'relative'
    }}>
      {/* Animated radar/shield scan top bar decoration */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '10%',
        right: '10%',
        height: '2px',
        background: 'linear-gradient(90deg, transparent, var(--danger), transparent)',
        boxShadow: '0 0 10px var(--danger)'
      }} />

      <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '24px' }}>
        <Logo variant="mark" size={48} />
      </div>

      <div style={{
        width: '72px',
        height: '72px',
        background: 'rgba(239, 68, 68, 0.12)',
        border: '2px solid #ef4444',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444',
        margin: '0 auto 24px',
        boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
      }}>
        <ShieldAlert size={36} />
      </div>

      <h1 style={{
        fontSize: '22px',
        fontWeight: 700,
        letterSpacing: '-0.5px',
        color: '#f87171',
        marginBottom: '12px'
      }}>
        ACCESS BLOCKED BY SECURE GATEWAY
      </h1>
      
      <p style={{
        fontSize: '13px',
        color: '#94a3b8',
        lineHeight: '1.6',
        marginBottom: '32px'
      }}>
        Adaptive Secure Gateway mendeteksi ancaman tingkat tinggi (**HIGH Risk**) pada URL/file yang Anda coba akses. Akses dibatalkan demi keamanan data perusahaan.
      </p>

      {/* Threat cache card */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '10px',
        padding: '20px',
        textAlign: 'left',
        marginBottom: '32px',
        fontSize: '13px'
      }}>
        <div style={{
          fontSize: '11px',
          color: '#ef4444',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '14px',
          fontFamily: 'monospace'
        }}>
          🛡️ Threat Intelligence Cache Details
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={{ color: '#64748b' }}>Blocked Source (URL):</span>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#e2e8f0',
              background: 'rgba(255,255,255,0.03)',
              padding: '8px',
              borderRadius: '6px',
              marginTop: '4px',
              wordBreak: 'break-all',
              border: '1px solid rgba(255,255,255,0.02)'
            }}>{rawUrl}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Detection Engine:</span>
              <div style={{ fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>{source}</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Threat Type:</span>
              <div style={{ fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>{threatType}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Cache ID:</span>
              <div style={{ fontFamily: 'monospace', color: '#e2e8f0', marginTop: '2px' }}>{cacheId}</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Threat Score:</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '2px'
              }}>
                <div style={{
                  width: '60px',
                  height: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${score}%`,
                    height: '100%',
                    background: '#ef4444'
                  }} />
                </div>
                <span className="mono" style={{ color: '#ef4444', fontWeight: 700 }}>{score}/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '12px 24px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
          onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
        >
          <ArrowLeft size={16} /> Kembali ke Halaman Aman
        </button>

        <button
          onClick={handleReport}
          disabled={reported || isReporting}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            color: reported ? '#34d399' : '#94a3b8',
            border: `1px solid ${reported ? '#34d399' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '13px',
            cursor: reported || isReporting ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          {reported ? (
            <><ShieldCheck size={16} /> Tiket Discrepancy Telah Dikirim ke SOC</>
          ) : isReporting ? (
            'Mengirim Laporan...'
          ) : (
            <><HelpCircle size={16} /> Laporkan Salah Deteksi (False Positive)</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function BlockedPage() {
  return (
    <div className="app" style={{
      background: 'radial-gradient(circle at center, #110606 0%, #060202 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      color: '#f1f5f9',
      padding: '24px'
    }}>
      {/* Background glow lines */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '500px',
        height: '500px',
        background: 'rgba(239, 68, 68, 0.05)',
        filter: 'blur(100px)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />

      <Suspense fallback={
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Mengevaluasi Keamanan Gateway...</p>
        </div>
      }>
        <BlockedContent />
      </Suspense>
    </div>
  );
}
