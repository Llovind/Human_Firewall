'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { MockEmail, timeAgo, formatWIB } from '@/components/admin/types';

interface MockWebmailSectionProps {
  readOnly: boolean;
  emails: MockEmail[];
  selectedEmail: MockEmail | null;
  onSelectEmail: (email: MockEmail) => void;
}

export default function MockWebmailSection({ readOnly, emails, selectedEmail, onSelectEmail }: MockWebmailSectionProps) {
  return (
    <div className="webmail-panel fade-up font-body" style={{ marginBottom: '48px' }}>
      <div className="webmail-sidebar">
        <div className="webmail-sidebar-header font-heading">
          <Inbox size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} /> Mock Webmail Inbox ({emails.length})
        </div>
        <div className="email-list">
          {emails.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Inbox is empty.
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className={`email-item ${selectedEmail?.id === email.id ? 'active' : ''}`}
                onClick={() => onSelectEmail(email)}
              >
                <div className="email-item-subject">{email.subject}</div>
                <div className="email-item-to">To: <span className="font-mono-data">{email.to_email}</span></div>
                <div className="email-item-date font-mono-data">{timeAgo(email.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="webmail-content">
        {selectedEmail ? (
          <>
            <div className="webmail-content-header">
              <h2 className="webmail-subject font-heading">{selectedEmail.subject}</h2>
              <div className="webmail-meta font-body">
                <span>To: <strong className="font-mono-data">{selectedEmail.to_email}</strong></span>
                <span style={{ margin: '0 8px' }}>·</span>
                <span>Received: <strong className="font-mono-data">{formatWIB(selectedEmail.created_at)}</strong></span>
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
                        let targetUrl = href;
                        if (typeof window !== 'undefined') {
                          if (targetUrl.includes('flask_api')) {
                            // Dynamically map internal container hostname to the hostname the client is accessing from
                            targetUrl = targetUrl.replace('flask_api', window.location.hostname);
                          } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                            const backendOrigin = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
                            targetUrl = `${backendOrigin.replace(/\/$/, '')}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
                          }
                        }
                        window.open(targetUrl, '_blank', 'noopener,noreferrer');
                      }
                    });
                  });
                }}
              />
            </div>
          </>
        ) : (
          <div className="webmail-empty-state font-body">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <h3 className="font-heading">Select an email to inspect</h3>
            <p>Click an email from the left sidebar to review simulation contents and headers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
