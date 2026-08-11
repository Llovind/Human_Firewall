const fs = require('fs');

function replaceAdmin() {
  const file = 'C:/Human_Firewall/dashboard/src/app/admin/page.tsx';
  let content = fs.readFileSync(file, 'utf8');
  
  const replacements = {
    '🚨 Insiden Terbaru': '<AlertTriangle size={18} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> Insiden Terbaru',
    '🤖 AI Threat Summary': '<Bot size={18} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> AI Threat Summary',
    '📊 Divisional Risk Map': '<Activity size={18} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> Divisional Risk Map',
    '⚖️ Compliance Score': '<CheckCircle2 size={18} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> Compliance Score',
    '🔍 Threat Intelligence Cache': '<Search size={18} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> Threat Intelligence Cache',
    '🏆 GAMIFICATION FILTERS': '<Trophy size={14} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> GAMIFICATION FILTERS',
    '🏆 Division Leaderboard (Rata-rata Poin)': '<Trophy size={18} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> Division Leaderboard (Rata-rata Poin)',
    '👤 Individual Security Leaderboard': '<Users size={18} style={{ marginRight: \\'8px\\', verticalAlign: \\'text-bottom\\' }} /> Individual Security Leaderboard',
    '🚀 Launch Now': '<Play size={14} style={{ marginRight: \\'8px\\' }} /> Launch Now',
    '<div className=\"stat-icon stat-icon-danger\">🚨</div>': '<div className=\"stat-icon stat-icon-danger\"><AlertTriangle size={24} /></div>',
    '<div className=\"stat-icon stat-icon-warning\">⚡</div>': '<div className=\"stat-icon stat-icon-warning\"><Activity size={24} /></div>',
    '<div className=\"stat-icon stat-icon-accent\">🛡️</div>': '<div className=\"stat-icon stat-icon-accent\"><Shield size={24} /></div>',
    '<div className=\"stat-icon stat-icon-success\">📈</div>': '<div className=\"stat-icon stat-icon-success\"><TrendingUp size={24} /></div>',
    "| '📋'": "| <FileWarning size={14} />",
  };
  
  for (const [old, newVal] of Object.entries(replacements)) {
    content = content.split(old).join(newVal);
  }
  
  const oldIcons = `const severityIcon: Record<string, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🟢',
};
const actionIcon: Record<string, string> = {
  block: '🛑', warning: '⚠️', allow: '✅', notify_soc: '📡',
};
const typeIcon: Record<string, string> = {
  phishing_click: '🎣', phishing_report: '🛡️', malware_detected: '🦠',
  suspicious_url: '🔗', dlp_violation: '📎',
};`;

  const newIcons = `const severityIcon: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={14} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  high: <AlertTriangle size={14} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  medium: <AlertTriangle size={14} style={{ color: 'var(--info)', marginRight: '4px' }} />,
  low: <CheckCircle2 size={14} style={{ color: 'var(--success)', marginRight: '4px' }} />,
};
const actionIcon: Record<string, React.ReactNode> = {
  block: <StopCircle size={14} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  warning: <FileWarning size={14} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  allow: <CheckCircle2 size={14} style={{ color: 'var(--success)', marginRight: '4px' }} />,
  notify_soc: <Activity size={14} style={{ color: 'var(--info)', marginRight: '4px' }} />,
};
const typeIcon: Record<string, React.ReactNode> = {
  phishing_click: <Fish size={14} style={{ marginRight: '4px' }} />,
  phishing_report: <Shield size={14} style={{ marginRight: '4px' }} />,
  malware_detected: <Bot size={14} style={{ marginRight: '4px' }} />,
  suspicious_url: <Search size={14} style={{ marginRight: '4px' }} />,
  dlp_violation: <FileWarning size={14} style={{ marginRight: '4px' }} />,
};`;

  content = content.replace(oldIcons, newIcons);
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced emojis in admin/page.tsx');
}

replaceAdmin();