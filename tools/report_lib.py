"""构建 Word 设计报告的底层排版工具（python-docx）。

只负责“怎么排”，不负责“写什么”；内容在 report_content.py 里，由 build_report.py 串起来。
"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BODY_CN = "宋体"
HEAD_CN = "黑体"
BODY_EN = "Times New Roman"
MONO = "Consolas"

INK = RGBColor(0x1A, 0x1D, 0x21)
GRAY = RGBColor(0x59, 0x5F, 0x66)


def _set_run_fonts(run, ascii_font, east_asia, size=None, bold=None, color=None):
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = color
    run.font.name = ascii_font
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), ascii_font)
    rfonts.set(qn("w:hAnsi"), ascii_font)
    rfonts.set(qn("w:eastAsia"), east_asia)


def shade_paragraph(paragraph, fill="F4F5F7"):
    ppr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    ppr.append(shd)


def shade_cell(cell, fill="F2F3F5"):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def _field(paragraph, instr, placeholder=""):
    """插入一个 Word 域（目录 / 页码）。"""
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    it = OxmlElement("w:instrText")
    it.set(qn("xml:space"), "preserve")
    it.text = instr
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    txt = OxmlElement("w:t")
    txt.text = placeholder
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for node in (begin, it, sep, txt, end):
        run._r.append(node)
    return run


class Report:
    def __init__(self):
        self.doc = Document()
        self._setup_page()
        self._setup_styles()

    # ---------- 页面与样式 ----------
    def _setup_page(self):
        s = self.doc.sections[0]
        s.page_width = Cm(21.0)
        s.page_height = Cm(29.7)
        s.top_margin = Cm(2.54)
        s.bottom_margin = Cm(2.54)
        s.left_margin = Cm(2.8)
        s.right_margin = Cm(2.8)
        s.header_distance = Cm(1.5)
        s.footer_distance = Cm(1.5)
        self.usable_width = 21.0 - 2.8 * 2  # 15.4cm

    def _setup_styles(self):
        normal = self.doc.styles["Normal"]
        normal.font.name = BODY_EN
        normal.font.size = Pt(12)
        normal.font.color.rgb = INK
        normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_CN)
        pf = normal.paragraph_format
        pf.line_spacing = 1.5
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)

        specs = [
            ("Heading 1", 16, 18, 12),
            ("Heading 2", 14, 14, 8),
            ("Heading 3", 12, 10, 6),
        ]
        for name, size, before, after in specs:
            st = self.doc.styles[name]
            st.font.size = Pt(size)
            st.font.bold = True
            st.font.color.rgb = INK
            st.font.name = BODY_EN
            st.element.rPr.rFonts.set(qn("w:eastAsia"), HEAD_CN)
            st.paragraph_format.space_before = Pt(before)
            st.paragraph_format.space_after = Pt(after)
            st.paragraph_format.line_spacing = 1.4
            st.paragraph_format.keep_with_next = True

    def enable_footer(self):
        """页脚：第 X 页（封面不显示）。"""
        s = self.doc.sections[0]
        s.different_first_page_header_footer = True
        p = s.footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("— ")
        _set_run_fonts(r, BODY_EN, BODY_CN, size=10.5, color=GRAY)
        _field(p, "PAGE", "1")
        r2 = p.add_run(" —")
        _set_run_fonts(r2, BODY_EN, BODY_CN, size=10.5, color=GRAY)

    def enable_header(self, text):
        s = self.doc.sections[0]
        s.different_first_page_header_footer = True
        p = s.header.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = p.add_run(text)
        _set_run_fonts(r, BODY_EN, BODY_CN, size=9, color=GRAY)

    # ---------- 基本块 ----------
    def rich(self, paragraph, text, size=12, bold=False, east_asia=BODY_CN, ascii_font=BODY_EN, color=None):
        """支持 **加粗** 的内联写法。"""
        for i, seg in enumerate(text.split("**")):
            if not seg:
                continue
            run = paragraph.add_run(seg)
            _set_run_fonts(run, ascii_font, east_asia, size=size, bold=(bold or i % 2 == 1), color=color)

    def p(self, text, indent=True, size=12, space_after=1.5, align=None, color=None):
        paragraph = self.doc.add_paragraph()
        pf = paragraph.paragraph_format
        pf.line_spacing = 1.5
        pf.space_after = Pt(space_after)
        if indent:
            pf.first_line_indent = Pt(size * 2)
        if align is not None:
            paragraph.alignment = align
        self.rich(paragraph, text, size=size, color=color)
        return paragraph

    def note(self, text):
        paragraph = self.doc.add_paragraph()
        paragraph.paragraph_format.line_spacing = 1.4
        paragraph.paragraph_format.space_before = Pt(2)
        paragraph.paragraph_format.space_after = Pt(8)
        self.rich(paragraph, text, size=10.5, color=GRAY)
        return paragraph

    def bullets(self, items, size=12):
        for it in items:
            paragraph = self.doc.add_paragraph(style="List Bullet")
            paragraph.paragraph_format.line_spacing = 1.5
            paragraph.paragraph_format.space_after = Pt(1)
            self.rich(paragraph, it, size=size)

    def h1(self, text, page_break=True):
        if page_break:
            self.doc.add_page_break()
        h = self.doc.add_heading(level=1)
        self.rich(h, text, size=16, bold=True, east_asia=HEAD_CN)
        return h

    def h2(self, text):
        h = self.doc.add_heading(level=2)
        self.rich(h, text, size=14, bold=True, east_asia=HEAD_CN)
        return h

    def h3(self, text):
        h = self.doc.add_heading(level=3)
        self.rich(h, text, size=12, bold=True, east_asia=HEAD_CN)
        return h

    def caption(self, text):
        paragraph = self.doc.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.space_before = Pt(8)
        paragraph.paragraph_format.space_after = Pt(4)
        paragraph.paragraph_format.keep_with_next = True
        self.rich(paragraph, text, size=10.5, bold=True, east_asia=HEAD_CN)
        return paragraph

    def table(self, caption, headers, rows, widths=None, font_size=10.5, align_first_left=True):
        if caption:
            self.caption(caption)
        table = self.doc.add_table(rows=1, cols=len(headers))
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False

        if widths is None:
            widths = [self.usable_width / len(headers)] * len(headers)

        # 1) 把列宽写进 tblGrid —— 只设 cell.width 在 LibreOffice/WPS 里常被忽略
        for i, w in enumerate(widths):
            table.columns[i].width = Cm(w)

        # 2) 表宽固定为各列之和（autofit=False 已写入 tblLayout=fixed，这里只改既有 tblW，
        #    不能再 append，否则出现重复元素、前者生效）
        tblPr = table._tbl.tblPr
        tblW = tblPr.find(qn("w:tblW"))
        if tblW is None:
            tblW = OxmlElement("w:tblW")
            tblPr.insert_element_before(tblW, "w:jc", "w:tblCellSpacing", "w:tblInd",
                                        "w:tblBorders", "w:shd", "w:tblLayout", "w:tblCellMar", "w:tblLook")
        tblW.set(qn("w:type"), "dxa")
        tblW.set(qn("w:w"), str(int(sum(widths) * 567)))

        # 3) 列内对齐统一：整列都短就居中，否则左对齐，避免同列有的居中有的靠左
        center_cols = []
        for i in range(len(headers)):
            vals = [str(r[i]) for r in rows if i < len(r)]
            center_cols.append(all(len(v) <= 12 for v in vals) if vals else True)

        def row_props(row, header=False):
            trPr = row._tr.get_or_add_trPr()
            # 行内内容不跨页拆开
            trPr.append(OxmlElement("w:cantSplit"))
            if header:
                trPr.append(OxmlElement("w:tblHeader"))  # 跨页时重复表头

        hdr = table.rows[0]
        row_props(hdr, header=True)
        for i, h in enumerate(headers):
            cell = hdr.cells[i]
            cell.width = Cm(widths[i])
            cell.text = ""
            paragraph = cell.paragraphs[0]
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            paragraph.paragraph_format.line_spacing = 1.1
            paragraph.paragraph_format.space_before = Pt(1.5)
            paragraph.paragraph_format.space_after = Pt(1.5)
            paragraph.paragraph_format.keep_with_next = True
            self.rich(paragraph, h, size=font_size, bold=True, east_asia=HEAD_CN)
            shade_cell(cell)

        for row in rows:
            tr = table.add_row()
            row_props(tr)
            cells = tr.cells
            for i, val in enumerate(row):
                cell = cells[i]
                cell.width = Cm(widths[i])
                cell.text = ""
                paragraph = cell.paragraphs[0]
                paragraph.paragraph_format.line_spacing = 1.1
                paragraph.paragraph_format.space_before = Pt(1.5)
                paragraph.paragraph_format.space_after = Pt(1.5)
                if i == 0 and align_first_left:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
                elif center_cols[i]:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                self.rich(paragraph, str(val), size=font_size)

        spacer = self.doc.add_paragraph()
        spacer.paragraph_format.space_after = Pt(2)
        spacer.paragraph_format.line_spacing = 1.0
        return table

    def code(self, text):
        lines = text.strip("\n").split("\n")
        for i, line in enumerate(lines):
            paragraph = self.doc.add_paragraph()
            pf = paragraph.paragraph_format
            pf.line_spacing = 1.15
            pf.space_before = Pt(4 if i == 0 else 0)
            pf.space_after = Pt(4 if i == len(lines) - 1 else 0)
            pf.left_indent = Cm(0.5)
            run = paragraph.add_run(line if line else " ")
            _set_run_fonts(run, MONO, MONO, size=9, color=INK)
            shade_paragraph(paragraph, "F5F6F8")

    def toc(self):
        paragraph = self.doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(6)
        # 去掉段落边框，避免部分渲染器给目录域画外框
        ppr = paragraph._p.get_or_add_pPr()
        pbdr = OxmlElement("w:pBdr")
        for edge in ("top", "left", "bottom", "right"):
            el = OxmlElement("w:" + edge)
            el.set(qn("w:val"), "none")
            el.set(qn("w:sz"), "0")
            el.set(qn("w:space"), "0")
            pbdr.append(el)
        ppr.append(pbdr)
        run = _field(paragraph, 'TOC \\o "1-3" \\h \\z \\u', "目录占位：在 Word 中右键此处，选择「更新域 → 更新整个目录」。")
        _set_run_fonts(run, BODY_EN, BODY_CN, size=10.5, color=GRAY)

    def figure(self, path, caption, width_cm=None):
        """插入居中的图片 + 图题（图题在图下方）。"""
        paragraph = self.doc.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.space_before = Pt(10)
        paragraph.paragraph_format.space_after = Pt(2)
        paragraph.paragraph_format.keep_with_next = True
        run = paragraph.add_run()
        run.add_picture(path, width=Cm(width_cm or self.usable_width))

        cap = self.doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_before = Pt(0)
        cap.paragraph_format.space_after = Pt(10)
        self.rich(cap, caption, size=10.5, bold=True, east_asia=HEAD_CN)

    def page_break(self):
        self.doc.add_page_break()

    def borderless(self, table):
        """去掉表格边框（封面信息块用）。必须插到 tblPr 的合法位置，否则会被忽略。"""
        tblPr = table._tbl.tblPr
        old = tblPr.find(qn("w:tblBorders"))
        if old is not None:
            tblPr.remove(old)
        borders = OxmlElement("w:tblBorders")
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            el = OxmlElement("w:" + edge)
            el.set(qn("w:val"), "none")
            el.set(qn("w:sz"), "0")
            el.set(qn("w:space"), "0")
            borders.append(el)
        tblPr.insert_element_before(borders, "w:shd", "w:tblLayout", "w:tblCellMar",
                                    "w:tblLook", "w:tblCaption", "w:tblDescription")

    def save(self, path):
        self.doc.save(path)
