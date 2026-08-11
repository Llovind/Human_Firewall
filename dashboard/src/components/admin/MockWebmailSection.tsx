'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { MockEmail, timeAgo } from '@/components/admin/types';

interface MockWebmailSectionProps {
  readOnly: boolean;
  emails: MockEmail[];
  selectedEmail: MockEmail | null;
  onSelectEmail: (email: MockEmail) => void;
}

export default function MockWebmailSection({ readOnly, emails, selectedEmail, onSelectEmail }: MockWebmailSectionProps) {
  return (
    <div className="webmail-panel fade-up" style={{ marginBottom: '48px' }}>
      <div className="webmail-sidebar">
        <div className="webmail-sidebar-header">
          <Inbox size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} /> Mock Webmail Inbox ({emails.length})
        </div>
        <div className="email-list">
          {emails.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Inbox kosong.
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className={`email-item ${selectedEmail?.id === email.id ? 'active' : ''}`}
                onClick={() => onSelectEmail(email)}
              >
                <div className="email-item-subject">{email.subject}</div>
                <div className="email-item-to">Ke: {email.to_email}</div>
                <div className="email-item-date">{timeAgo(email.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="webmail-content">
        {selectedEmail ? (
          <>
            <div className="webmail-content-header">
              <h2 className="webmail-subject">{selectedEmail.subject}</h2>
              <div className="webmail-meta">
                <span>Ke: <strong>{selectedEmail.to_email}</strong></span>
                <span style={{ margin: '0 8px' }}>·</span>
                <span>Diterima: {new Date(selectedEmail.created_at).toLocaleString('id-ID')}</span>
              </div>
            </div>
            <div className="webmail-body">
              {/* Render email safely via iframe with srcDoc to isolate custom phishing link styles.
                   onLoad intercepts all <a> clicks and routes them through Secure Gateway /go?url=... */}
              <iframe
                srcDoc={selectedEmail.body}
                title="Webmail Body"
                onLoad={(e) => {
                  const iframeDoc = (e.target as HTMLIFrameElement).contentDocument;
                  if (!iframeDoc) return;
                  iframeDoc.querySelectorAll('a').forEach((a) => {
                    a.addEventListener('click', (evt) => {
                      evt.preventDefault();
                      if (readOnly) return;
                      const href = a.getAttribute('href');
                      if (href && href !== '#') {
                        // Route through Secure Gateway proxy for threat check
                        const gatewayUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/go?url=${encodeURIComponent(href)}`;
                        window.open(gatewayUrl, '_blank', 'noopener,noreferrer');
                      }
                    });
                  });
                }}
              />
            </div>
          </>
        ) : (
          <div className="webmail-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <h3>Pilih email untuk dibaca</h3>
            <p>Klik salah satu email di sidebar untuk melihat isi konten simulasi.</p>
          </div>
        )}
      </div>
    </div>
  );
}
