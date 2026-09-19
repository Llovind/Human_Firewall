'use client';

import { useSearchParams } from 'next/navigation';
import { ShieldAlert, AlertOctagon, HelpCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import { useState, Suspense } from 'react';
import '@/app/globals.css';

function BlockedContent() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get('url') || 'https://phishing-portal.net/verify-login';
  const source = searchParams.get('source') || 'AFFERENT ML';
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
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderTop: '3px solid var(--danger)',
      borderRadius: '12px',
      padding: '40px 32px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-md)',
      position: 'relative'
    }}>
      <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '20px' }}>
        <Logo variant="mark" size={48} />
      </div>

      <div style={{
        width: '56px',
        height: '56px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--danger)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--danger)',
        margin: '0 auto 20px',
      }}>
        <ShieldAlert size={28} />
      </div>

      <h1 className="font-heading" style={{
        fontSize: '20px',
        fontWeight: 700,
        letterSpacing: '-0.3px',
        color: 'var(--danger)',
        marginBottom: '10px'
      }}>
        ACCESS BLOCKED BY SECURE GATEWAY
      </h1>
      
      <p style={{
        fontSize: '13px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        marginBottom: '28px'
      }}>
        The adaptive secure gateway detected a critical risk factor on the requested URL. Access was terminated to prevent credential harvesting and data exposure.
      </p>

      {/* Threat cache card */}
      <div style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        textAlign: 'left',
        marginBottom: '28px',
        fontSize: '13px'
      }}>
        <div style={{
          fontSize: '11px',
          color: 'var(--danger)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: '12px',
          fontFamily: 'var(--font-mono-data)'
        }}>
          Threat Intelligence Telemetry
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Blocked Target URL:</span>
            <div style={{
              fontFamily: 'var(--font-mono-data)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              background: 'var(--bg-elevated)',
              padding: '8px 10px',
              borderRadius: '6px',
              marginTop: '4px',
              wordBreak: 'break-all',
              border: '1px solid var(--border)'
            }}>{rawUrl}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Detection Source:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '12px' }}>{source}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Classification:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '12px' }}>{threatType}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Cache Identifier:</span>
              <div style={{ fontFamily: 'var(--font-mono-data)', color: 'var(--text-primary)', marginTop: '2px', fontSize: '12px' }}>{cacheId}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Risk Score:</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '2px'
              }}>
                <div style={{
                  width: '60px',
                  height: '6px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${score}%`,
                    height: '100%',
                    background: 'var(--danger)'
                  }} />
                </div>
                <span className="font-mono-data" style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '12px' }}>{score}/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '11px 20px',
            background: 'var(--danger)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--danger)'}
        >
          <ArrowLeft size={16} /> Return to Secure Workspace
        </button>

        <button
          onClick={handleReport}
          disabled={reported || isReporting}
          style={{
            padding: '11px 20px',
            background: 'transparent',
            color: reported ? 'var(--success)' : 'var(--text-secondary)',
            border: `1px solid ${reported ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '13px',
            cursor: reported || isReporting ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          {reported ? (
            <><ShieldCheck size={16} /> Discrepancy Ticket Sent to SOC</>
          ) : isReporting ? (
            'Submitting telemetry report...'
          ) : (
            <><HelpCircle size={16} /> Report False Positive to SOC</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function BlockedPage() {
  return (
    <div className="app" style={{
      backgroundColor: 'var(--bg-deep)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      color: 'var(--text-primary)',
      padding: '24px'
    }}>
      <Suspense fallback={
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Evaluating Gateway Security State...</p>
        </div>
      }>
        <BlockedContent />
      </Suspense>
    </div>
  );
}
