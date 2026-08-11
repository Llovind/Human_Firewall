const fs = require('fs');

function replaceEmployee() {
  const file = 'C:/Human_Firewall/dashboard/src/app/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Insert imports
  if (!content.includes('lucide-react')) {
    content = content.replace(
      "import Logo from '@/components/Logo';",
      "import Logo from '@/components/Logo';\\nimport { LayoutDashboard, Fish, Shield, ShieldCheck, Timer, Lightbulb, Search, Flame, BookOpen, Star, FileWarning, CheckCircle2, AlertTriangle, Trophy } from 'lucide-react';"
    );
  }

  const replacements = {
    '📊 My Dashboard': '<LayoutDashboard size={14} style={{ marginRight: "8px" }} /> My Dashboard',
    '🎣 Spot the Fake': '<Fish size={14} style={{ marginRight: "8px" }} /> Spot the Fake',
    '🛡️ Log Aktivitas Keamanan Anda': '<Shield size={18} style={{ marginRight: "8px" }} /> Log Aktivitas Keamanan Anda',
    '🎣 Pelatihan Retraining: Spot the Fake': '<Fish size={18} style={{ marginRight: "8px" }} /> Pelatihan Retraining: Spot the Fake',
    '<span style={{ fontSize: \\'64px\\' }}>🛡️</span>': '<ShieldCheck size={64} style={{ color: "var(--success)" }} />',
    '<span style={{ fontSize: \\'64px\\' }}>⏳</span>': '<Timer size={64} style={{ color: "var(--warning)" }} />',
    '💡 Gerakkan kursor (hover) di atas elemen portal di bawah untuk menginspeksi keamanan.': '<span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Lightbulb size={14} /> Gerakkan kursor (hover) di atas elemen portal di bawah untuk menginspeksi keamanan.</span>',
    '🔍 {inspectItem.title}': '<span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Search size={14} /> {inspectItem.title}</span>',
    '<span className="mini-stat-icon">🔥</span>': '<span className="mini-stat-icon"><Flame size={14} /></span>',
    '<span className="mini-stat-icon">📚</span>': '<span className="mini-stat-icon"><BookOpen size={14} /></span>',
    '<span className="mini-stat-icon">⭐</span>': '<span className="mini-stat-icon"><Star size={14} /></span>',
    // We are keeping 🏆 for Rank and spot_the_fake_correct
  };
  
  for (const [old, newVal] of Object.entries(replacements)) {
    content = content.split(old).join(newVal);
  }

  const oldEventLabels = `const eventLabels: Record<string, { label: string; icon: string; color: string }> = {
  clicked_link: { label: 'Mengklik Link Phishing', icon: '🎣', color: 'var(--danger)' },
  submitted_data: { label: 'Kebocoran Kredensial', icon: '⚠️', color: 'var(--danger)' },
  viewed_training: { label: 'Mengikuti Retraining', icon: '📚', color: 'var(--success)' },
  skipped_training: { label: 'Melewati Retraining', icon: '💨', color: 'var(--warning)' },
  phishing_click: { label: 'Terjebak Phishing Simulasi', icon: '🚨', color: 'var(--danger)' },
  spot_the_fake_correct: { label: 'Menang Spot the Fake', icon: '🏆', color: 'var(--success)' },
  spot_the_fake_incorrect: { label: 'Kalah Spot the Fake', icon: '❌', color: 'var(--warning)' },
};`;

  const newEventLabels = `const eventLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  clicked_link: { label: 'Mengklik Link Phishing', icon: <Fish size={14} />, color: 'var(--danger)' },
  submitted_data: { label: 'Kebocoran Kredensial', icon: <FileWarning size={14} />, color: 'var(--danger)' },
  viewed_training: { label: 'Mengikuti Retraining', icon: <CheckCircle2 size={14} />, color: 'var(--success)' },
  skipped_training: { label: 'Melewati Retraining', icon: <AlertTriangle size={14} />, color: 'var(--warning)' },
  phishing_click: { label: 'Terjebak Phishing Simulasi', icon: <Fish size={14} />, color: 'var(--danger)' },
  spot_the_fake_correct: { label: 'Menang Spot the Fake', icon: '🏆', color: 'var(--success)' },
  spot_the_fake_incorrect: { label: 'Kalah Spot the Fake', icon: '❌', color: 'var(--warning)' },
};`;

  content = content.replace(oldEventLabels, newEventLabels);
  
  // also replace the fallback icon in the timeline map
  content = content.replace(
    "icon: '📋'",
    "icon: <FileWarning size={14} />"
  );
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced emojis in page.tsx');
}

replaceEmployee();