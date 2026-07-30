import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT

def create_pdf():
    pdf_filename = r"C:\Human_Firewall\HUMAN_FIREWALL_PITCH_KITAB.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    NAVY = colors.HexColor("#0A2540")
    DARK_BLUE = colors.HexColor("#1E3A8A")
    ACCENT_BLUE = colors.HexColor("#3B82F6")
    TEXT_DARK = colors.HexColor("#1E293B")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#CBD5E1")

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=NAVY,
        alignment=TA_CENTER,
        spaceAfter=8
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=ACCENT_BLUE,
        alignment=TA_CENTER,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=DARK_BLUE,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_DARK,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4,
        alignment=TA_LEFT
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=body_style,
        fontName='Helvetica-Oblique',
        fontSize=10,
        leading=14,
        textColor=NAVY,
        alignment=TA_CENTER
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white,
        alignment=TA_CENTER
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_DARK,
        alignment=TA_LEFT
    )

    story = []

    # Read Markdown Source
    md_file = r"C:\Human_Firewall\PRODUCT_SINGLE_SOURCE_OF_TRUTH.md"
    with open(md_file, 'r', encoding='utf-8') as f:
        md_text = f.read()

    lines = md_text.splitlines()

    # Title & Header Banner
    story.append(Spacer(1, 10))
    story.append(Paragraph("🛡️ HUMAN FIREWALL PLATFORM", title_style))
    story.append(Paragraph("MASTER PRODUCT SINGLE SOURCE OF TRUTH & PITCHING KITAB", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT_BLUE, spaceBefore=5, spaceAfter=15))

    # Helper for formatting Markdown inline text to HTML
    def parse_inline(text):
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
        text = re.sub(r'`(.*?)`', r'<font face="Courier" color="#1E3A8A"><b>\1</b></font>', text)
        return text

    in_table = False
    table_rows = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Handle Tables
        if line.startswith('|') and '|' in line[1:]:
            if '---' in line:
                i += 1
                continue
            cols = [parse_inline(c.strip()) for c in line.split('|')[1:-1]]
            if cols:
                table_rows.append(cols)
            in_table = True
            i += 1
            continue
        elif in_table:
            # End of table, render table
            if table_rows:
                num_cols = max(len(r) for r in table_rows)
                formatted_table_data = []
                for r_idx, row in enumerate(table_rows):
                    formatted_row = []
                    for c_idx, cell in enumerate(row):
                        st = table_header_style if r_idx == 0 else table_cell_style
                        formatted_row.append(Paragraph(cell, st))
                    # Pad missing columns if any
                    while len(formatted_row) < num_cols:
                        formatted_row.append(Paragraph("", table_cell_style))
                    formatted_table_data.append(formatted_row)

                # Table styling
                t = Table(formatted_table_data, colWidths=[540 / num_cols] * num_cols)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(Spacer(1, 4))
                story.append(t)
                story.append(Spacer(1, 8))
                table_rows = []
            in_table = False

        if not line:
            i += 1
            continue

        # Skip main title & Table of contents links in Markdown
        if line.startswith('# 🛡️ HUMAN FIREWALL') or line.startswith('## Master Product') or line.startswith('## 📌 DAFTAR ISI'):
            i += 1
            continue
        if re.match(r'^\d+\.\s+\[.*\]\(#.*\)', line):
            i += 1
            continue

        # Headings
        if line.startswith('## '):
            heading_text = parse_inline(line[3:])
            story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceBefore=8, spaceAfter=4))
            story.append(Paragraph(heading_text, h1_style))
        elif line.startswith('### '):
            heading_text = parse_inline(line[4:])
            story.append(Paragraph(heading_text, h2_style))
        elif line.startswith('> '):
            quote_text = parse_inline(line[2:])
            callout_data = [[Paragraph(quote_text, callout_style)]]
            callout_table = Table(callout_data, colWidths=[540])
            callout_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
                ('BOX', (0, 0), (-1, -1), 1, ACCENT_BLUE),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ]))
            story.append(Spacer(1, 4))
            story.append(callout_table)
            story.append(Spacer(1, 6))
        elif line.startswith('* ') or line.startswith('- ') or line.startswith('• '):
            bullet_text = "• " + parse_inline(line[2:])
            story.append(Paragraph(bullet_text, bullet_style))
        elif re.match(r'^\d+\.\s+', line):
            bullet_text = parse_inline(line)
            story.append(Paragraph(bullet_text, bullet_style))
        elif line.startswith('```'):
            # Code block rendering
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                code_lines.append(lines[i])
                i += 1
            code_content = "<br/>".join([line_code.replace(" ", "&nbsp;") for line_code in code_lines])
            code_style = ParagraphStyle(
                'CodeStyle',
                parent=styles['Normal'],
                fontName='Courier',
                fontSize=7.5,
                leading=10,
                textColor=DARK_BLUE
            )
            code_table = Table([[Paragraph(code_content, code_style)]], colWidths=[540])
            code_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
                ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(Spacer(1, 4))
            story.append(code_table)
            story.append(Spacer(1, 6))
        else:
            story.append(Paragraph(parse_inline(line), body_style))

        i += 1

    # Render PDF
    doc.build(story)
    print("PDF Successfully Generated:", pdf_filename)

if __name__ == '__main__':
    create_pdf()
