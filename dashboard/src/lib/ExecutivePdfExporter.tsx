'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';

// Register Styles for Executive Report
const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#0F172A', // Slate-900
    color: '#F8FAFC',
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6', // Blue-500
    borderBottomStyle: 'solid',
    paddingBottom: 10,
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#60A5FA', // Blue-400
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 8,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  metaBox: {
    backgroundColor: '#1E293B',
    borderRadius: 4,
    padding: 10,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  metaText: {
    fontSize: 9,
    color: '#CBD5E1',
    marginVertical: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#38BDF8',
    marginTop: 15,
    marginBottom: 8,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 4,
  },
  paragraph: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#E2E8F0',
    marginBottom: 8,
    textAlign: 'justify',
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 6,
  },
  bulletDot: {
    width: 10,
    fontSize: 10,
    color: '#38BDF8',
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: '#E2E8F0',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#64748B',
  },
});

interface ReportPdfDocumentProps {
  role: string;
  markdownContent: string;
  generatedAt: string;
}

// Parse markdown into clean PDF elements
const parseMarkdownToPdfElements = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('# ')) {
      // Main Title
      elements.push(
        <Text key={idx} style={{ fontSize: 16, fontWeight: 'bold', color: '#60A5FA', marginBottom: 10 }}>
          {trimmed.replace('# ', '')}
        </Text>
      );
    } else if (trimmed.startsWith('## ')) {
      // Section Header
      elements.push(
        <Text key={idx} style={styles.sectionTitle}>
          {trimmed.replace('## ', '')}
        </Text>
      );
    } else if (trimmed.startsWith('> ')) {
      // Callout box
      elements.push(
        <View key={idx} style={styles.metaBox}>
          <Text style={styles.metaText}>{trimmed.replace('> ', '')}</Text>
        </View>
      );
    } else if (trimmed.startsWith('- ')) {
      // Bullet list item
      const cleanText = trimmed.replace('- ', '').replace(/\*\*/g, '');
      elements.push(
        <View key={idx} style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{cleanText}</Text>
        </View>
      );
    } else if (!trimmed.startsWith('|')) {
      // Regular paragraph
      const cleanText = trimmed.replace(/\*\*/g, '');
      elements.push(
        <Text key={idx} style={styles.paragraph}>
          {cleanText}
        </Text>
      );
    }
  });

  return elements;
};

const ReportPdfDocument: React.FC<ReportPdfDocumentProps> = ({
  role,
  markdownContent,
  generatedAt,
}) => (
  <Document title={`AFFERENT_${role.toUpperCase()}_Executive_Report`}>
    <Page size="A4" style={styles.page}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>AFFERENT</Text>
          <Text style={styles.brandSub}>HUMAN RISK INTELLIGENCE & TELEMETRY PLATFORM</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 8, color: '#38BDF8', fontWeight: 'bold' }}>EXECUTIVE REPORT</Text>
          <Text style={{ fontSize: 8, color: '#94A3B8' }}>ROLE: {role.toUpperCase()}</Text>
        </View>
      </View>

      {/* Metadata Box */}
      <View style={styles.metaBox}>
        <Text style={styles.metaText}>Generated At: {generatedAt}</Text>
        <Text style={styles.metaText}>Classification: CONFIDENTIAL / INTERNAL SECURITY DIRECTIVE</Text>
        <Text style={styles.metaText}>Compiler Engine: AFFERENT Client Vector Renderer v2.0</Text>
      </View>

      {/* Main Content Body */}
      <View style={{ flex: 1 }}>
        {parseMarkdownToPdfElements(markdownContent)}
      </View>

      {/* Footer Page Bar */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>CONFIDENTIAL — AFFERENT HUMAN RISK PLATFORM</Text>
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  </Document>
);

export async function exportExecutivePdf(role: string, markdownContent: string): Promise<void> {
  const generatedAt = new Date().toLocaleString('id-ID', { timeZoneName: 'short' });
  const doc = <ReportPdfDocument role={role} markdownContent={markdownContent} generatedAt={generatedAt} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `AFFERENT_${role.toUpperCase()}_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
