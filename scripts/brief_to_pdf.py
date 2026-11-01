#!/usr/bin/env python3
"""Deterministic markdown -> A4 PDF renderer for Encourt briefs.

Usage: python3 scripts/brief_to_pdf.py <input.md> <output.pdf>

Supports the subset of markdown the briefs actually use: ATX headings (#..####),
GFM pipe tables, - bullets, 1. ordered lists, --- rules, blockquote-free prose,
**bold**, *italic*, `code`, [text](http links) (clickable), and [[wikilinks]] (plain text).
Same input -> same output. No AI judgement.
"""
import re
import sys
import html as _html

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, HRFlowable, KeepTogether,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)

INK = colors.HexColor("#141414")
MUTED = colors.HexColor("#5b5b5b")
RULE = colors.HexColor("#d4d4d4")
BAND = colors.HexColor("#f2f0ec")
ACCENT = colors.HexColor("#1f4d3d")


def styles():
    ss = getSampleStyleSheet()
    base = dict(fontName="Helvetica", textColor=INK, alignment=TA_LEFT)
    return {
        "h1": ParagraphStyle("h1", ss["Normal"], fontName="Helvetica-Bold", fontSize=17,
                             leading=21, spaceBefore=2, spaceAfter=8, textColor=ACCENT),
        "h2": ParagraphStyle("h2", ss["Normal"], fontName="Helvetica-Bold", fontSize=12.5,
                             leading=15.5, spaceBefore=14, spaceAfter=5, textColor=ACCENT),
        "h3": ParagraphStyle("h3", ss["Normal"], fontName="Helvetica-Bold", fontSize=10.5,
                             leading=13.5, spaceBefore=10, spaceAfter=4, **{}),
        "h4": ParagraphStyle("h4", ss["Normal"], fontName="Helvetica-BoldOblique", fontSize=9.5,
                             leading=12.5, spaceBefore=8, spaceAfter=3),
        "body": ParagraphStyle("body", ss["Normal"], fontSize=9, leading=12.6,
                               spaceAfter=5.5, **base),
        "bullet": ParagraphStyle("bullet", ss["Normal"], fontSize=9, leading=12.4,
                                 spaceAfter=3, leftIndent=10, bulletIndent=1, **base),
        "cell": ParagraphStyle("cell", ss["Normal"], fontSize=7.9, leading=10.2, textColor=INK,
                               fontName="Helvetica"),
        "cellh": ParagraphStyle("cellh", ss["Normal"], fontSize=7.9, leading=10.2, textColor=INK,
                                fontName="Helvetica-Bold"),
        "foot": ParagraphStyle("foot", ss["Normal"], fontSize=7.5, leading=10, textColor=MUTED),
    }


def inline(text):
    """Markdown inline -> reportlab mini-HTML."""
    text = text.replace("[[", "").replace("]]", "")
    # protect code spans first
    codes = []

    def _code(m):
        codes.append(m.group(1))
        return "\x00%d\x00" % (len(codes) - 1)

    text = re.sub(r"`([^`]+)`", _code, text)
    text = _html.escape(text, quote=False)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)",
                  r'<link href="\2" color="#1f4d3d"><u>\1</u></link>', text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    def _uncode(m):
        return '<font name="Courier" size="8">%s</font>' % _html.escape(codes[int(m.group(1))],
                                                                        quote=False)

    return re.sub(r"\x00(\d+)\x00", _uncode, text)


def split_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def build(md_path, pdf_path):
    S = styles()
    raw = open(md_path, encoding="utf-8").read().split("\n")
    flow = []
    i = 0
    avail = A4[0] - 30 * mm

    while i < len(raw):
        ln = raw[i]
        s = ln.strip()

        if not s:
            i += 1
            continue

        if re.fullmatch(r"-{3,}|\*{3,}", s):
            flow.append(Spacer(1, 3))
            flow.append(HRFlowable(width="100%", thickness=0.6, color=RULE,
                                   spaceBefore=1, spaceAfter=7))
            i += 1
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            lvl = len(m.group(1))
            flow.append(Paragraph(inline(m.group(2)), S["h%d" % lvl]))
            i += 1
            continue

        # table
        if s.startswith("|") and i + 1 < len(raw) and re.fullmatch(
                r"\|[\s:\-|]+\|?", raw[i + 1].strip()):
            head = split_row(s)
            i += 2
            body = []
            while i < len(raw) and raw[i].strip().startswith("|"):
                body.append(split_row(raw[i]))
                i += 1
            ncol = len(head)
            data = [[Paragraph(inline(c), S["cellh"]) for c in head]]
            for r in body:
                r = (r + [""] * ncol)[:ncol]
                data.append([Paragraph(inline(c), S["cell"]) for c in r])
            first = max(0.20, min(0.46, 1.0 - 0.11 * (ncol - 1)))
            widths = [avail * first] + [avail * (1 - first) / (ncol - 1)] * (ncol - 1) \
                if ncol > 1 else [avail]
            t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BAND),
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, RULE),
                ("INNERGRID", (0, 1), (-1, -1), 0.25, colors.HexColor("#e6e4e0")),
                ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]))
            flow.append(Spacer(1, 2))
            flow.append(t)
            flow.append(Spacer(1, 8))
            continue

        m = re.match(r"^[-*]\s+(.*)$", s)
        if m:
            flow.append(Paragraph(inline(m.group(1)), S["bullet"], bulletText="\u2022"))
            i += 1
            continue

        m = re.match(r"^(\d+)\.\s+(.*)$", s)
        if m:
            flow.append(Paragraph(inline(m.group(2)), S["bullet"],
                                  bulletText="%s." % m.group(1)))
            i += 1
            continue

        # paragraph (join soft-wrapped lines)
        buf = [s]
        i += 1
        while i < len(raw) and raw[i].strip() and not re.match(
                r"^(#{1,4}\s|[-*]\s|\d+\.\s|\||-{3,}$)", raw[i].strip()):
            buf.append(raw[i].strip())
            i += 1
        flow.append(Paragraph(inline(" ".join(buf)), S["body"]))

    def deco(canv, doc):
        canv.saveState()
        canv.setFont("Helvetica", 7)
        canv.setFillColor(MUTED)
        canv.drawString(15 * mm, 11 * mm, "Encourt — internal")
        canv.drawRightString(A4[0] - 15 * mm, 11 * mm, "p%d" % doc.page)
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.4)
        canv.line(15 * mm, 14.5 * mm, A4[0] - 15 * mm, 14.5 * mm)
        canv.restoreState()

    doc = BaseDocTemplate(pdf_path, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                          topMargin=15 * mm, bottomMargin=18 * mm, title=md_path.split("/")[-1])
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=deco)])
    doc.build(flow)


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
