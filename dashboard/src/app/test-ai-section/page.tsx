'use client';

import React from 'react';
import { AIIntelligenceSection } from '@/components/admin/AIIntelligenceSection';

export default function TestAiSectionPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Standalone AI Component Test Harness (Gate 2)</h1>
        <AIIntelligenceSection role="soc" />
      </div>
    </div>
  );
}
