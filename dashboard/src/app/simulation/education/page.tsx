import Link from 'next/link';
import { ArrowRight, ShieldCheck, ShieldAlert, Link2, Flag, LockKeyhole } from 'lucide-react';
import '@/app/security-pages.css';

const signals = [
  { Icon: ShieldAlert, title: 'Urgency is not proof', text: 'An unexpected password reset request can pressure you into acting before checking.' },
  { Icon: Link2, title: 'Check the address, not the design', text: 'Convincing emails and login pages can be copied. Verify the sender and domain.' },
  { Icon: Flag, title: 'When in doubt, report it', text: 'Use Report a link in your dashboard. Do not reply or forward the suspicious link.' },
];

export default function SimulationEducation() {
  return <main className="security-screen" data-tone="education"><div className="security-workspace">
    <header className="security-brand"><span><ShieldCheck size={25} /> AFFERENT<span className="security-brand-divider">/</span><small>Human Security</small></span><span className="security-status">Awareness simulation</span></header>
    <article className="security-shell">
      <section className="security-hero"><span className="security-icon"><ShieldAlert size={38} strokeWidth={1.6} /></span><span className="security-eyebrow">PAUSE. CHECK THE SIGNALS.</span><h1>This was a<br />phishing simulation.</h1><p className="security-lead">No password was changed. Use this moment to learn how convincing phishing can look.</p><div className="security-assurance"><LockKeyhole size={20} /><div><strong>Your credentials were not collected</strong><p>The demo records a submission event only. Email and password values are not sent or stored.</p></div></div><Link className="security-primary" href="/">Back to dashboard <ArrowRight size={17} /></Link></section>
      <section className="security-guidance" aria-labelledby="education-next"><span className="security-eyebrow">WHAT TO REMEMBER</span><h2 id="education-next">Three habits that help</h2><div className="security-steps">{signals.map(({ Icon, title, text }, index) => <article key={title}><span className="security-step-icon"><Icon size={20} /></span><div><small>0{index + 1}</small><h3>{title}</h3><p>{text}</p></div></article>)}</div><div className="security-note"><strong>Use a trusted bookmark to open your work portal.</strong><p>If you entered a real password on a suspicious site, change it through the official portal and contact SOC.</p></div></section>
    </article><footer className="security-footer"><span><ShieldCheck size={15} /> Learn from the simulation. Be ready for the real thing.</span><span>Click and submission events follow AFFERENT scoring. Updates may take a few seconds.</span></footer>
  </div></main>;
}
