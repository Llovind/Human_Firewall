'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck, ShieldBan, LockKeyhole, FileSearch, Flag } from 'lucide-react';
import '@/app/security-pages.css';

function BlockedContent() {
  const params = useSearchParams();
  // Display context only: query parameters do not prove a threat or a score.
  const target = params.get('domain') || params.get('url') || 'No domain provided';
  const reason = params.get('reason');
  return <main className="security-screen" data-tone="blocked"><div className="security-workspace">
    <header className="security-brand"><span><ShieldCheck size={25} /> AFFERENT<span className="security-brand-divider">/</span><small>Secure Gateway</small></span><span className="security-status">Access restricted</span></header>
    <article className="security-shell">
      <section className="security-hero"><span className="security-icon"><ShieldBan size={38} strokeWidth={1.6} /></span><span className="security-eyebrow">BLOCKED BY AFFERENT</span><h1>This request<br />was blocked.</h1><p className="security-lead">Access was denied by a security policy or a pending domain check. Do not bypass the protection.</p><div className="security-target"><span>DESTINATION</span><strong>{target}</strong></div>{reason && <p className="security-reason">Reason: {reason}</p>}<Link className="security-primary" href="/">Open dashboard <ArrowRight size={17} /></Link></section>
      <section className="security-guidance"><span className="security-eyebrow">NEXT STEPS</span><h2>Need access for work?</h2><div className="security-steps"><article><span className="security-step-icon"><FileSearch size={20} /></span><div><small>01</small><h3>Check the address</h3><p>Check the domain for typos or lookalike names.</p></div></article><article><span className="security-step-icon"><Flag size={20} /></span><div><small>02</small><h3>Request a SOC review</h3><p>Report the link from your dashboard and explain why you need access. This page does not submit a ticket.</p></div></article></div><div className="security-note"><LockKeyhole size={18} /><p>Allowed HTTPS connections stay encrypted. A temporary denial does not mean the domain is malicious or blacklisted.</p></div></section>
    </article><footer className="security-footer"><span><ShieldCheck size={15} /> AFFERENT · Human-centric security</span><span>Access decisions are reviewed by SOC.</span></footer>
  </div></main>;
}

export default function BlockedPage() {
  return <Suspense fallback={<main className="security-screen">Loading security information…</main>}><BlockedContent /></Suspense>;
}
