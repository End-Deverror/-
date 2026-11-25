# -*- coding: utf-8 -*-
"""生成《SWOT 分析与 UML 用例建模》.docx。

用法（在项目根目录）：
    python tools/build_swot_usecase.py [输出路径]

内容依据仓库真实代码整理：cloudfunctions/api/index.js、web/js/*.js、scripts/*.mjs、
docs/部署说明.md；外部市场数据见文末参考文献。
"""
import os
import re
import sys

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BODY_CN = "宋体"
HEAD_CN = "黑体"
EN_FONT = "Times New Roman"
BLACK = RGBColor(0, 0, 0)
GRAY = RGBColor(0x59, 0x59, 0x59)

TOKEN_RE = re.compile(r"(\*\*.+?\*\*|\^\[\d+\])")


def set_run_font(run, size, east_asia=BODY_CN, bold=None, color=BLACK, superscript=None):
    run.font.name = EN_FONT
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    run.font.color.rgb = color
    if superscript is not None:
        run.font.superscript = superscript
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), EN_FONT)
    rfonts.set(qn("w:hAnsi"), EN_FONT)
    rfonts.set(qn("w:eastAsia"), east_asia)


def add_rich_runs(par, text, size, east_asia=BODY_CN, color=BLACK):
    for part in TOKEN_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = par.add_run(part[2:-2])
            set_run_font(run, size, east_asia, bold=True, color=color)
        elif part.startswith("^[") and part.endswith("]"):
            run = par.add_run(part[1:])
            set_run_font(run, size, east_asia, color=color, superscript=True)
        else:
            run = par.add_run(part)
            set_run_font(run, size, east_asia, color=color)


def shade(cell, fill="D9D9D9"):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def set_table_borders(table):
    tblpr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "808080")
        borders.append(el)
    tblpr.append(borders)


def set_cell_margins(table):
    tblpr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for edge, w in (("top", 36), ("left", 108), ("bottom", 36), ("right", 108)):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:w"), str(w))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tblpr.append(mar)


def set_table_width(table, widths_cm):
    total = int(sum(widths_cm) / 2.54 * 1440)
    tblpr = table._tbl.tblPr
    tblw = OxmlElement("w:tblW")
    tblw.set(qn("w:w"), str(total))
    tblw.set(qn("w:type"), "dxa")
    tblpr.append(tblw)
    for idx, w in enumerate(widths_cm):
        table.columns[idx].width = Cm(w)


def row_flags(row, header=False):
    trpr = row._tr.get_or_add_trPr()
    cant = OxmlElement("w:cantSplit")
    trpr.append(cant)
    if header:
        th = OxmlElement("w:tblHeader")
        trpr.append(th)


def fill_cell(cell, text, align=WD_ALIGN_PARAGRAPH.LEFT, size=10.5, bold=False):
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    pf = p.paragraph_format
    pf.first_line_indent = Cm(0)
    pf.left_indent = Cm(0)
    pf.right_indent = Cm(0)
    pf.line_spacing = 1.0
    pf.space_before = Pt(2)
    pf.space_after = Pt(2)
    p.alignment = align
    lines = str(text).split("\n")
    for i, line in enumerate(lines):
        for part in TOKEN_RE.split(line):
            if not part:
                continue
            if part.startswith("**") and part.endswith("**"):
                run = p.add_run(part[2:-2])
                set_run_font(run, size, bold=True)
            elif part.startswith("^[") and part.endswith("]"):
                run = p.add_run(part[1:])
                set_run_font(run, size, superscript=True)
            else:
                run = p.add_run(part)
                set_run_font(run, size, bold=bold)
        if i < len(lines) - 1:
            p.add_run().add_break()


class Doc:
    def __init__(self):
        self.doc = Document()
        self._setup()
        self.after_table = False

    def _setup(self):
        sec = self.doc.sections[0]
        sec.page_width = Cm(21)
        sec.page_height = Cm(29.7)
        for side in ("top_margin", "bottom_margin", "left_margin", "right_margin"):
            setattr(sec, side, Cm(2.5))

        normal = self.doc.styles["Normal"]
        normal.font.name = EN_FONT
        normal.font.size = Pt(12)
        normal.font.color.rgb = BLACK
        rpr = normal.element.get_or_add_rPr()
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = OxmlElement("w:rFonts")
            rpr.append(rfonts)
        rfonts.set(qn("w:ascii"), EN_FONT)
        rfonts.set(qn("w:hAnsi"), EN_FONT)
        rfonts.set(qn("w:eastAsia"), BODY_CN)
        normal.paragraph_format.line_spacing = 1.5
        normal.paragraph_format.space_before = Pt(0)
        normal.paragraph_format.space_after = Pt(0)

        for name, size, before, after in (("Heading 1", 16, 14, 6),
                                          ("Heading 2", 14, 11, 5),
                                          ("Heading 3", 12, 9, 4)):
            st = self.doc.styles[name]
            st.font.name = EN_FONT
            st.font.size = Pt(size)
            st.font.bold = True
            st.font.color.rgb = BLACK
            rpr = st.element.get_or_add_rPr()
            rfonts = rpr.find(qn("w:rFonts"))
            if rfonts is None:
                rfonts = OxmlElement("w:rFonts")
                rpr.append(rfonts)
            rfonts.set(qn("w:ascii"), EN_FONT)
            rfonts.set(qn("w:hAnsi"), EN_FONT)
            rfonts.set(qn("w:eastAsia"), HEAD_CN)
            st.paragraph_format.space_before = Pt(before)
            st.paragraph_format.space_after = Pt(after)
            st.paragraph_format.line_spacing = 1.3
            st.paragraph_format.first_line_indent = Cm(0)
            st.paragraph_format.keep_with_next = True

    # ---------- 基础排版 ----------
    def body(self, text, size=12, indent=True):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        pf = p.paragraph_format
        pf.line_spacing = 1.5
        pf.space_before = Pt(6) if self.after_table else Pt(0)
        pf.space_after = Pt(0)
        pf.first_line_indent = Pt(size * 2) if indent else Cm(0)
        add_rich_runs(p, text, size)
        self.after_table = False
        return p

    def h1(self, text, new_page=True):
        p = self.doc.add_paragraph(style="Heading 1")
        if new_page:
            p.paragraph_format.page_break_before = True
        run = p.add_run(text)
        set_run_font(run, 16, HEAD_CN, bold=True)
        self.after_table = False
        return p

    def h2(self, text):
        p = self.doc.add_paragraph(style="Heading 2")
        run = p.add_run(text)
        set_run_font(run, 14, HEAD_CN, bold=True)
        self.after_table = False
        return p

    def caption(self, text, before=6, after=4):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = p.paragraph_format
        pf.first_line_indent = Cm(0)
        pf.space_before = Pt(before)
        pf.space_after = Pt(after)
        pf.line_spacing = 1.0
        run = p.add_run(text)
        set_run_font(run, 10.5)
        self.after_table = False
        return p

    def table(self, caption, headers, rows, widths, aligns=None, size=10.5):
        self.caption(caption, before=8, after=4)
        table = self.doc.add_table(rows=1, cols=len(headers))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        set_table_width(table, widths)
        set_table_borders(table)
        set_cell_margins(table)

        hdr = table.rows[0]
        row_flags(hdr, header=True)
        for i, h in enumerate(headers):
            cell = hdr.cells[i]
            cell.width = Cm(widths[i])
            shade(cell)
            fill_cell(cell, h, WD_ALIGN_PARAGRAPH.CENTER, size=size, bold=True)

        for r in rows:
            row = table.add_row()
            row_flags(row)
            for i, val in enumerate(r):
                cell = row.cells[i]
                cell.width = Cm(widths[i])
                if aligns and i < len(aligns):
                    align = aligns[i]
                elif i == 0:
                    align = WD_ALIGN_PARAGRAPH.CENTER
                else:
                    align = WD_ALIGN_PARAGRAPH.LEFT
                fill_cell(cell, val, align, size=size)
        self.after_table = True
        return table

    def figure(self, path, caption, width_cm=15.4, note=None):
        if not os.path.isabs(path):
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            path = os.path.join(base, path)
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = p.paragraph_format
        pf.first_line_indent = Cm(0)
        pf.space_before = Pt(6)
        pf.space_after = Pt(4)
        pf.line_spacing = 1.0
        p.add_run().add_picture(path, width=Cm(width_cm))
        self.caption(caption, before=4, after=4)
        if note:
            q = self.doc.add_paragraph()
            q.alignment = WD_ALIGN_PARAGRAPH.LEFT
            qf = q.paragraph_format
            qf.first_line_indent = Cm(0)
            qf.space_before = Pt(0)
            qf.space_after = Pt(10)
            qf.line_spacing = 1.3
            run = q.add_run(note)
            set_run_font(run, 10.5, color=GRAY)
        self.after_table = False

    # ---------- 分节与页码 ----------
    def page_field(self, section):
        section.footer.is_linked_to_previous = False
        p = section.footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run()
        set_run_font(run, 10.5)

        begin = OxmlElement("w:fldChar")
        begin.set(qn("w:fldCharType"), "begin")
        instr = OxmlElement("w:instrText")
        instr.set(qn("xml:space"), "preserve")
        instr.text = " PAGE "
        sep = OxmlElement("w:fldChar")
        sep.set(qn("w:fldCharType"), "separate")
        txt = OxmlElement("w:t")
        txt.text = "1"
        end = OxmlElement("w:fldChar")
        end.set(qn("w:fldCharType"), "end")
        for node in (begin, instr, sep, txt, end):
            run._r.append(node)

    def empty_footer(self, section):
        section.footer.is_linked_to_previous = False
        for p in section.footer.paragraphs:
            for r in list(p.runs):
                r._r.getparent().remove(r._r)

    def toc(self):
        sec = self.doc.add_section(WD_SECTION.NEW_PAGE)
        self.empty_footer(sec)

        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(18)
        run = p.add_run("目　　录")
        set_run_font(run, 18, HEAD_CN, bold=True)

        p = self.doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.0
        run = p.add_run()
        set_run_font(run, 12)

        begin = OxmlElement("w:fldChar")
        begin.set(qn("w:fldCharType"), "begin")
        instr = OxmlElement("w:instrText")
        instr.set(qn("xml:space"), "preserve")
        instr.text = ' TOC \\o "1-2" \\h \\z \\u '
        sep = OxmlElement("w:fldChar")
        sep.set(qn("w:fldCharType"), "separate")
        txt = OxmlElement("w:t")
        txt.text = "打开文档后，按 Ctrl+A 再按 F9 即可生成目录。"
        end = OxmlElement("w:fldChar")
        end.set(qn("w:fldCharType"), "end")
        for node in (begin, instr, sep, txt, end):
            run._r.append(node)

    def body_section(self):
        sec = self.doc.add_section(WD_SECTION.NEW_PAGE)
        self.page_field(sec)
        sectpr = sec._sectPr
        pg = OxmlElement("w:pgNumType")
        pg.set(qn("w:start"), "1")
        sectpr.append(pg)


def cover(d):
    p = d.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(130)
    p.paragraph_format.space_after = Pt(10)
    run = p.add_run("校园集市 SWOT 分析与 UML 用例建模")
    set_run_font(run, 26, HEAD_CN, bold=True)

    p = d.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("校园集市（Campus Market）· 学生二手交易平台 V1")
    set_run_font(run, 13, "楷体")

    p = d.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(80)
    run = p.add_run("软件系统分析报告")
    set_run_font(run, 11, "楷体")

    info = [
        ("项目名称", "校园集市（Campus Market）"),
        ("分析对象", "仓库 testApp：前端 web/、云函数 cloudfunctions/api/"),
        ("文档类型", "SWOT 分析与 UML 用例建模"),
        ("分析基准", "V1 已实现代码与部署文档"),
        ("完成日期", "2026 年 11 月"),
    ]
    table = d.doc.add_table(rows=len(info), cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    tblpr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "none")
        borders.append(el)
    tblpr.append(borders)
    for idx, (k, v) in enumerate(info):
        cells = table.rows[idx].cells
        cells[0].width = Cm(4.2)
        cells[1].width = Cm(9.8)
        p0 = cells[0].paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p0.paragraph_format.line_spacing = 1.8
        run = p0.add_run(k + "：")
        set_run_font(run, 12)
        p1 = cells[1].paragraphs[0]
        p1.paragraph_format.line_spacing = 1.8
        p1.paragraph_format.left_indent = Cm(0.3)
        run = p1.add_run(v)
        set_run_font(run, 12)


def abstract(d):
    d.h1("摘要", new_page=False)
    d.body("本报告以「校园集市」V1 为分析对象，依据仓库中的前端页面、云函数接口、部署文档与自动化检查，完成 SWOT 分析与 UML 用例建模。分析要回答两个问题：这个产品在校园二手场景中的真实优势与约束是什么；它的功能边界能否被一组完整、可追溯的用例覆盖。")
    d.body("核心判断是，产品的竞争力来自三件事的叠加：平台不经手资金，因而没有支付资质与资金池风险；商品与订单由服务端状态机管理，交易过程可以留痕；前端静态托管、后端单个云函数，部署与试错成本极低。28 个服务端接口、5 个数据集合与 85 项自动化检查表明，V1 已具备可运行的完整闭环，而不是演示原型。")
    d.body("主要短板集中在信任与治理，而非功能数量。联系方式在商品详情页直接暴露，站内没有留言与举报，交易一旦开始就离开平台；手机号与学号只做格式校验，身份与信用无法验证；下单锁定没有超时释放，一次爽约即可让商品长期不可售；管理员只有一个角色、一个注册码，缺少审计与申诉。这些问题会让平台退化为「信息墙」，难以形成复购。")
    d.body("用例建模识别出 3 类人类参与者、16 个用例与 9 组用例关系，主成功路径及取消、驳回等异常路径都能在代码中找到对应实现。模型同时暴露四个缺口：缺少找回密码与账号注销、缺少举报与申诉、缺少通知类系统用例、管理端用例的前置状态未在接口层强制。建议按「先补信任闭环、再扩规模」的顺序推进：P0 做站内留言与举报、预订超时释放与通知、隐私最小化与注销、管理员权限与审计；P1 再做身份核验、评价体系与搜索索引。受限于静态代码审阅与年度市场数据，本报告不对真实转化率与留存作推断。")


def chapter1(d):
    d.h1("1　分析对象与方法")
    d.h2("1.1　产品定位与实现概况")
    d.body("校园集市面向单所高校的在校学生，提供闲置商品的发布、检索、下单与面交确认。它与闲鱼、转转等综合平台的差别不在品类覆盖，而在交易结构：平台不接入支付，买卖双方线下当面交付，平台只承担撮合、审核与状态留痕。这一定位决定了系统的功能边界，也决定了它的优势与短板。")
    d.body("从实现看，这是一个刻意控制复杂度的系统。前端是可直接部署的静态页面，后端是一个承载 28 个 Action 的云函数，数据落在 5 个文档型集合里。没有自建服务器、没有构建工具、没有第三方前端依赖，源文件即产物。")
    d.table("表 1-1　产品与技术事实", ["维度", "事实", "证据"], [
        ["产品形态", "纯静态 Web（原生 ES Module，无构建）加微信云开发", "web/ 目录；README.md"],
        ["功能规模", "13 个前端路由、28 个服务端 Action、5 个数据集合", "app.js 的 ROUTES；index.js 的 handlers；COLL"],
        ["参与者", "游客、学生（同一账号兼买家与卖家）、管理员", "auth.register 的 role 字段；README.md"],
        ["数据对象", "用户、商品、购物车、订单、面交地址", "users / products / carts / orders / addresses"],
        ["状态机", "商品 6 种状态；订单 3 种状态", "config.js 的 PRODUCT_STATUS、ORDER_STATUS"],
        ["质量保障", "85 项自动化检查：30 项后端、5 项 HTTP、50 项前端", "scripts/selftest.mjs、http-check.mjs、dom-test.mjs"],
        ["部署", "静态网站托管、HTTP 访问服务、云函数", "docs/部署说明.md"],
        ["演示模式", "无云环境时用 localStorage 跑同一套接口契约", "api.js 的 resolve()；mock.js"],
    ], [2.4, 7.6, 6.0])
    d.body("这套结构把复杂度集中在两处：服务端的参数校验与状态流转，以及前端页面与接口之间的契约。它带来的直接结果是部署快、试错便宜；间接结果是治理能力与扩展能力被压缩在同一个云函数里。后文的优势与劣势，基本都是这两个选择的延伸。")

    d.h2("1.2　证据来源与分析方法")
    d.body("本报告不引用产品自述作为结论，而是以可复核的代码与文档为证据。内部事实来自仓库文件，外部环境只采用可追溯的公开数据与现行法律要求。")
    d.table("表 1-2　主要证据来源", ["材料", "在本文中的用途"], [
        ["README.md、docs/部署说明.md", "产品范围、部署方式、安全设计、已知问题与接口清单"],
        ["cloudfunctions/api/index.js", "接口、参数校验、状态流转、鉴权、错误处理"],
        ["web/js/app.js、api.js、mock.js、cloud.js", "页面入口、交互流程、登录拦截、本地与云端双实现"],
        ["scripts/selftest.mjs、http-check.mjs、dom-test.mjs", "功能覆盖、回归能力与测试边界"],
        ["docs/《软件系统设计报告》.docx", "术语、架构决策与需求编号的一致性"],
        ["网经社《2025年度中国网络零售市场数据报告》", "二手电商交易规模与增速，用于外部机会判断"],
    ], [6.0, 10.0])
    d.body("SWOT 采用「事实—判断」两段式：先列可验证的内部事实，再说明它对竞争的含义；机会与威胁只写有依据的条件，不做单校市场规模的推算。TOWS 交叉策略按「是否阻断交易闭环」「是否触发合规或安全风险」排序，而不是按实现难度排序。")
    d.body("UML 部分按 UML 2.5 用例图记法建模：参与者置于系统边界之外，边界内只保留用户目标级用例；«include» 表示每次执行都必需的子行为，«extend» 表示有条件触发的扩展，泛化用于表达参与者之间的继承。五个核心用例配有规约，字段与代码、测试保持可追溯。")

    d.h2("1.3　分析边界")
    d.body("本报告只评价 V1 已实现的行为，不把未实现功能直接计为缺陷；不评判代码风格、命名与目录组织；外部市场数据为年度口径，不能推导单校需求；用例规约描述「系统当前如何做」，不是「产品应该怎么做」。这些限制在结论中保留，避免把条件判断写成必然结论。")


def chapter2(d):
    d.h1("2　SWOT 分析")
    d.h2("2.1　优势：低风险、可追溯与低成本构成基本盘")
    d.body("优势集中在三处：不碰钱降低了合规与资金风险，状态机让交易可追溯，单函数加静态托管把部署成本压到接近零。三者相互支撑，构成本项目在校园小范围试点中最稳的基本盘。")
    d.table("表 2-1　优势（S）", ["编号", "优势", "代码与文档依据", "竞争含义"], [
        ["S1", "零资金风险：平台不接入支付，没有资金池、退款与支付资质问题", "handlers 中没有支付类 Action；README 明确「平台不经手钱款」", "避开高风险合规范畴，试点不需要金融资质"],
        ["S2", "交易可追溯：商品 6 状态、订单 3 状态、双方各确认一次、订单快照与唯一订单号", "order.create / confirm / cancel；order.items 存标题、价格、图片快照", "纠纷时能还原「谁在何时确认了什么」"],
        ["S3", "搜索可用：NFKC 归一，忽略大小写与全半角，最多 5 个词且词间为「且」，跨标题、描述、分类匹配", "splitTerms、haystack、matchAllTerms；product.list 的正则候选加内存过滤", "直接替代群聊「刷过去就找不到」的体验"],
        ["S4", "安全基线扎实：scrypt 加随机盐、HMAC-SHA256 令牌、定时安全比较、数据库对客户端关闭、服务端二次校验与归属检查", "index.js 的 hashPwd、signToken、readToken、requireUser；部署说明第 11 节", "课程项目中少见，降低拖库与越权风险"],
        ["S5", "成本低：单云函数加静态托管，无服务器、无备案域名，前后端独立发布", "部署说明第 1、3、7 节；AD-01、AD-05 决策", "学生团队可在课程周期内上线"],
        ["S6", "可测试、可演示：85 项检查；本地 mock 与云端同契约；可强制切回本地", "scripts/ 三个测试脚本；api.js 的 forceLocal()", "无云环境也能完整验收，降低评审门槛"],
    ], [1.4, 5.6, 5.2, 3.8])
    d.body("S2 与 S4 是真正的差异化。多数校园二手群连「谁先确认」都无法记录，本系统把确认、取消、驳回都写成可查询的状态；scrypt 加盐与 HMAC 令牌也超出课程项目的常见水平。S3 的搜索归一化直接对应群聊交易的信息损耗：输入片段即可命中，多个词之间是「且」，字段之间是「或」。")
    d.body("S5 与 S6 的价值在试错速度：没有云环境也能用 localStorage 完整走通流程，85 项检查随时可跑。对一个需要在课程周期内反复改动的项目，这比多做一个功能更能降低返工。")

    d.h2("2.2　劣势：信任与治理能力落后于交易功能")
    d.body("劣势不在功能覆盖，而在交易闭环的后半段：沟通、身份、时限与治理。它们共同指向一个问题——平台能撮合第一次交易，却很难保证第二次。")
    d.table("表 2-2　劣势（W）", ["编号", "劣势", "代码与文档依据", "影响"], [
        ["W1", "沟通闭环缺失：无站内聊天或留言，商品详情页登录后直接展示联系方式", "app.js 详情页输出 contactPhone；README 将站内聊天列为范围外", "交易一开口就离开平台，无法留痕，也难以阻止骚扰与跳单"],
        ["W2", "身份与信用不可验证：手机号只校验 11 位格式，无短信验证；学号只校验 6–12 位数字；无实名、评价、信用或黑名单", "auth.register 的参数校验；users 集合无认证字段", "「只服务本校」靠自觉，账号可被冒用或批量注册"],
        ["W3", "预订锁定无时限：下单即转为已预订，只能人工取消，无超时释放与违约成本", "order.create 置 reserved；order.cancel 手动回滚", "恶意占货或爽约会让商品长期不可售"],
        ["W4", "并发与状态守卫不足：下单先查后写，没有条件更新或事务；管理员通过、下架不校验当前状态", "order.create 逐件 getProduct 后再 update；admin.moderate、admin.takedown 直接改状态", "存在双卖窗口；已售商品可被改回在售或下架，破坏状态机"],
        ["W5", "搜索存在规模上限：数据库先取 100 条候选，再在内存里过滤与分页", "product.list 的 limit(100) 与 hits.slice", "命中超过 100 条时总数不准、结果不完整"],
        ["W6", "媒体链路脆弱且成本高：临时链接约十几分钟失效，只缓存 2 分钟；图片以 base64 经云函数上传，单张不超过 3MB，无缩略图", "resolveFileIDs 的 URL_CACHE_TTL；storage.upload；部署说明常见问题", "商品越老越容易裂图；上传占用函数流量与内存"],
        ["W7", "缺少通知与账号自救：订单变化无推送或短信；无密码找回、修改密码与注销", "handlers 清单；app.js 无相关页面", "双方需主动刷新；账号丢失即无法恢复"],
        ["W8", "治理单点：单一管理员角色、全局注册码、无操作审计、无举报入口、无驳回申诉", "auth.register 的 ADMIN_CODE；admin.* 接口", "审核质量依赖个人；密钥泄漏即失去治理权"],
        ["W9", "运维压力：28 个 Action 同函数，冷启动与 20 秒超时；无监控告警；本地 mock 与云端双实现需同步", "部署说明第 3、12 节；api.js 的 resolve()", "故障定位慢；两套实现容易行为漂移"],
    ], [1.4, 6.2, 5.4, 3.0])
    d.body("W1 与 W3 的叠加最致命：买家在详情页拿到电话后可以直接私下成交，平台失去留痕；即使留在平台，下单后也没有超时与违约成本，卖家无法判断订单是否有效。W4 是工程隐患：order.create 先查状态再写 reserved，中间没有条件更新或事务，理论上存在双卖窗口；admin.moderate 与 admin.takedown 不校验当前状态，可以把已售商品改回在售或下架，直接破坏 S2 的可追溯性。")
    d.body("W5 与 W6 是规模化的硬约束：搜索先取 100 条再在内存里过滤，命中超过上限后总数与分页都不再准确；图片以 base64 经过云函数上传，链接又是十几分钟即失效的签名地址。两者在课程演示中不显眼，在真实使用中会先暴露。")

    d.h2("2.3　机会：需求扩张与校园周期性供给")
    d.body("外部需求仍在扩张，校园的周期性供给与微信入口是两项可用杠杆。但机会能否转化，取决于平台能否先把「可信」做出来；否则规模越大，纠纷与治理成本上升得越快。")
    d.table("表 2-3　机会（O）", ["编号", "机会", "依据", "可利用方式"], [
        ["O1", "二手交易主流化：2025 年二手电商交易规模 8500 亿元，同比增长 31.77%^[1]", "网经社《2025年度中国网络零售市场数据报告》", "把「校内可信撮合」作为差异化，而不是与综合平台拼品类"],
        ["O2", "校园周期性供给：毕业季集中出货，开学季集中进货，教材、宿舍用品、小家电需求重叠", "校园场景常识；项目演示数据也以教材、数码、宿舍用品为主", "在毕业季前完成审核、搜索与面交地址的运营准备"],
        ["O3", "微信入口成本低：仓库已有小程序挂载页，可把 Web 页面装进 web-view，借助群分享获客", "miniprogram/pages/index；project.miniapp.json", "用小程序卡片替代群链接，降低进入门槛"],
        ["O4", "复制边际成本低：云开发按量计费，多校部署主要是环境变量与静态托管", "单云函数架构；部署说明第 4、7 节", "先做单校样板，再按 school 字段隔离复制"],
        ["O5", "绿色消费与校园治理相容：循环利用、低碳叙述易获得校方背书", "政策与校园治理导向；需以学校具体规定为准", "争取院系或后勤的官方推荐位"],
    ], [1.4, 5.0, 5.6, 4.0])
    d.body("O1 说明二手交易已从补充消费变成主流选择，但同一组数据也意味着综合平台的网络效应更强，校园垂类只能靠「近场、可信、低门槛」取胜。O3 的成本最低：挂载页已经就位，把 Web 页面装进小程序 web-view 即可获得群分享入口，但需要补齐业务域名与备案。")
    d.body("O2 是校园场景独有的节奏：毕业季集中出货、开学季集中进货，教材、宿舍用品与小家电的供需在同一时间窗口重叠。把审核、搜索与面交地址在这两个窗口前准备好，比全年平均用力更有效。")

    d.h2("2.4　威胁：综合平台、线下纠纷与合规约束")
    d.body("威胁分成两类：一类来自外部竞争与平台依赖，另一类来自线下交易与个人信息处理的硬约束。后者更危险，因为它不会因为产品做得轻而消失。")
    d.table("表 2-4　威胁（T）", ["编号", "威胁", "依据", "影响"], [
        ["T1", "综合平台虹吸：闲鱼、转转、小红书已占据用户心智；闲鱼「95 后」「00 后」用户占比 65%^[2]，转转在 2025 年关停个人自由交易、转向官方验^[3]", "新华网转载大众日报报道；36氪行业报道", "学生默认去大平台，校内平台只在大平台覆盖不足时被想起"],
        ["T2", "线下交易风险：诈骗、爽约、见面安全、假货或赃物；平台不碰钱也无法冻结", "产品定位与订单流程；无资金托管", "纠纷只能靠订单记录，负面事件直接伤害校内口碑"],
        ["T3", "个人信息合规：收集手机号、学号、学校、面交地点与联系方式，当前无隐私告知、无注销、无脱敏展示", "users、addresses、orders 的字段；《个人信息保护法》的告知同意、最小必要与删除权要求", "面临整改、投诉与校方叫停风险"],
        ["T4", "内容治理责任：违禁品、虚假描述、盗赃物；人工审核且无举报入口", "admin.moderate 单人审核；无举报 Action", "治理能力与内容增长不匹配"],
        ["T5", "账号与密钥风险：默认 ADMIN_CODE 与示例 TOKEN_SECRET 若未替换，管理员可被自封、令牌可被伪造；无验证码与限流", "index.js 的默认密钥；auth.register 的管理员码逻辑", "批量注册、撞库与越权风险"],
        ["T6", "云平台依赖：配额、价格、HTTP 访问服务与临时链接策略变化；默认调试域名不适合长期对外", "部署说明第 5、7、12 节", "成本与可用性受制于单一厂商"],
    ], [1.4, 5.6, 5.4, 3.6])
    d.body("T2 与 T3 是两条硬约束：线下交付的纠纷无法靠平台资金兜底，只能靠事前提示、事中留痕与事后举报；个人信息处理需要告知、最小必要、脱敏与删除机制，当前版本尚未提供隐私政策与账号注销。T5 属于可立即修复的配置风险：若部署时未替换 TOKEN_SECRET 与 ADMIN_CODE，令牌可被伪造、管理员可被自封。")

    d.h2("2.5　SWOT 矩阵")
    d.body("把四类条目压缩到一张矩阵，可以看到优势与劣势都集中在「交易结构」，机会与威胁都集中在「外部信任」。这也解释了下文的策略为什么优先补治理，而不是优先加功能。")
    d.table("表 2-5　SWOT 矩阵", ["维度", "有利因素", "不利因素"], [
        ["内部条件", "S1 零资金风险；S2 状态可追溯；S3 搜索归一化；S4 安全基线；S5 低部署成本；S6 可测试可演示",
         "W1 沟通离场；W2 身份不可验；W3 锁定无时限；W4 并发与状态守卫不足；W5 搜索上限；W6 媒体链路脆弱；W7 无通知与账号自救；W8 治理单点；W9 运维压力"],
        ["外部环境", "O1 二手交易扩张；O2 毕业季与开学季；O3 微信入口；O4 低边际复制；O5 绿色消费与校方背书",
         "T1 综合平台虹吸；T2 线下纠纷；T3 个人信息合规；T4 内容治理；T5 账号与密钥；T6 云平台依赖"],
    ], [2.6, 6.7, 6.7])

    d.h2("2.6　TOWS 交叉策略")
    d.body("交叉策略按优先级分为三档。P0 是阻断闭环或触发合规风险的事项，必须在推广前完成；P1 影响增长质量，可在小范围试点后补；P2 属于规模化能力，等前两档稳定后再做。")
    d.table("表 2-6　TOWS 交叉策略", ["编号", "策略", "对应条目", "优先级", "落地要点"], [
        ["SO1", "毕业季小范围试点", "S5、S6、O2", "P0", "先在 1–2 个学院跑通发布、面交、确认，用真实订单验证状态机与审核时长"],
        ["SO2", "把「双确认加订单快照」做成纠纷留证卖点", "S1、S2、O1", "P1", "商品页与订单页明确展示确认记录与快照，和群聊交易形成对比"],
        ["SO3", "小程序入口与多校复制", "S5、O3、O4", "P2", "Web 页面装进 web-view，配置业务域名；多校按 school 字段隔离"],
        ["WO1", "站内留言与商品举报", "W1、W8、O2", "P0", "下单前可问答，详情页可举报；管理员有处置队列"],
        ["WO2", "预订超时释放与关键节点通知", "W3、W7、O2", "P1", "48 小时未确认自动回在售；下单、驳回、完成三类事件可触达"],
        ["WO3", "校园身份核验与评价", "W2、O1", "P1", "学号对接名册或人工抽检；完成订单可互评，差评进入人工复核"],
        ["ST1", "用留痕与审核对抗线下纠纷", "S2、S4、T2、T4", "P0", "交易须知、安全提示、举报入口、审核记录四件套"],
        ["ST2", "用轻量模式对抗综合平台", "S1、S5、T1", "P1", "不拼品类与流量，拼同校、当面、零手续费"],
        ["ST3", "用密钥与权限治理对抗账号风险", "S4、T5", "P0", "强制配置检查、管理员双人复核、令牌可撤销"],
        ["WT1", "隐私最小化与账号注销", "W1、W2、T3", "P0", "联系方式默认脱敏、告知同意、支持注销与数据删除"],
        ["WT2", "治理双人复核与操作审计", "W8、T4、T5", "P1", "审核与下架写审计日志，敏感操作二次确认"],
        ["WT3", "明确服务边界与平台责任", "W3、T2、T6", "P1", "用户协议、交易须知、免责边界、云资源告警"],
    ], [1.6, 4.4, 3.2, 1.6, 5.2], aligns=[WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT])

    d.h2("2.7　小结")
    d.body("SWOT 的净判断是：优势在「风险与成本」，劣势在「信任与治理」，机会在「校园周期与微信入口」，威胁在「综合平台与合规」。因此战略应是「先做可信撮合层，再做规模」：在不引入支付的前提下，把沟通、时限、身份与审计补齐，才有资格谈多校复制。")
    d.body("这也意味着，下一版不应优先增加商品品类、推荐算法或优惠券。它们会放大流量，却不会修复 W1 至 W4 造成的结构性问题。")


def chapter3(d):
    d.h1("3　UML 用例建模")
    d.h2("3.1　建模目标与范围")
    d.body("用例建模回答两个问题：谁在使用系统，他们各自要达成什么目标；这些目标之间是否存在必须共享的子行为。建模范围为 V1 已实现的功能，不包含支付、站内聊天、评价与通知等未实现能力。")
    d.body("模型以代码为事实来源：前端路由决定用户可达的页面，云函数的 Action 决定服务端能力，状态字段决定用例的前置与后置条件。凡代码中没有的行为，不画进用例图。")

    d.h2("3.2　参与者")
    d.table("表 3-1　参与者识别", ["参与者", "类型", "进入方式", "主要目标", "建模依据"], [
        ["游客", "主要", "无需登录", "浏览、搜索、查看详情、注册、登录", "product.list、product.detail 为公开接口；联系方式需登录后可见"],
        ["学生", "主要", "手机号注册", "发布、加购、下单、确认、取消、维护资料与地址", "role 为 user；同一账号兼买家与卖家"],
        ["管理员", "主要", "注册时填写管理员码", "审核、驳回、下架、查看统计", "role 为 admin；admin.* 接口校验角色"],
        ["云开发平台", "次要", "系统内部调用", "提供数据库、云存储与临时链接", "cloud.database()、uploadFile、getTempFileURL"],
    ], [3.0, 2.4, 3.6, 4.2, 2.8])
    d.body("学生同时是买家与卖家，但两者不是两个参与者，而是同一参与者在不同用例中的角色。订单用 myRole 区分视角，列表用 role 参数切换「我买到的」与「我卖出的」，这与单一学生参与者的模型一致。若把买家、卖家拆成两个 actor，会把同一账号的两种视角误建模为两类人。")
    d.body("学生与游客之间存在泛化关系：学生继承游客的浏览、搜索、查看详情与注册登录行为，另拥有登录后才可执行的用例。图 1 中的空心三角指向游客，表示学生是子类型。")
    d.body("云数据库与云存储是系统内部的支撑组件，不承担用户目标，因此只作为次要参与者记录，不画入用例图，避免把技术组件误当业务角色。")

    d.h2("3.3　用例清单")
    d.body("按用户目标而非页面罗列，共识别 16 个用例。编号用于后文规约与追溯，不代表执行顺序。")
    d.table("表 3-2　用例清单", ["编号", "用例", "主要参与者", "目标", "服务端 Action"], [
        ["UC-01", "浏览商品列表", "游客、学生", "查看在售商品流", "product.list"],
        ["UC-02", "搜索商品", "游客、学生", "按关键词定位商品", "product.list"],
        ["UC-03", "查看商品详情", "游客、学生", "判断是否购买", "product.detail"],
        ["UC-04", "注册账号", "游客", "建立学生身份", "auth.register"],
        ["UC-05", "登录", "游客、学生、管理员", "取得登录态", "auth.login"],
        ["UC-06", "维护个人信息", "学生", "保持资料可用", "user.update"],
        ["UC-07", "管理面交地址", "学生", "复用常用交付地点", "address.list / save / remove"],
        ["UC-08", "发布商品", "学生（卖家）", "上架闲置", "product.publish、storage.upload"],
        ["UC-09", "管理购物车", "学生（买家）", "暂存待购商品", "cart.list / add / update / remove"],
        ["UC-10", "提交订单", "学生（买家）", "锁定商品并生成待面交订单", "order.create"],
        ["UC-11", "查看订单", "学生", "跟踪买入与卖出进度", "order.list、order.detail"],
        ["UC-12", "确认完成交易", "学生（买家或卖家）", "记录单方完成，双方确认后结单", "order.confirm"],
        ["UC-13", "取消订单", "学生（买家或卖家）", "终止订单并释放商品", "order.cancel"],
        ["UC-14", "审核商品", "管理员", "决定是否上架", "admin.list、admin.moderate"],
        ["UC-15", "下架违规商品", "管理员", "移除违规在售商品", "admin.takedown"],
        ["UC-16", "查看平台统计", "管理员", "掌握供需与用户规模", "admin.stats"],
    ], [1.4, 3.4, 3.2, 4.2, 3.8])
    d.body("清单刻意没有把「增删改查」拆成四个用例：购物车的加、改、删、看合并为「管理购物车」，资料的查看与修改合并为「维护个人信息」。用例的粒度以参与者的一次完整目标为准，过细会把界面操作误当成业务目标。")

    d.h2("3.4　系统总用例图")
    d.body("图 1 给出系统边界、三类人类参与者与 16 个用例的关联。左侧游客与学生共用公开浏览能力，中部是登录后的交易与账户能力，右侧是管理员的治理能力。")
    d.figure(os.path.join("docs", "figs", "fig-swot-usecase-system.png"), "图 1　系统总用例图", width_cm=14.6,
             note="注：依据 V1 前端路由、云函数 Action 与状态字段绘制，采用 UML 2.5 用例图记法。")
    d.body("图中没有画出「支付」「聊天」「评价」等用例，因为 V1 不提供这些行为；把它们画进来会让模型看起来完整，却与实现不符。总图也不展开 «include» 与 «extend»，以免十几条虚线互相遮挡，细化关系放在 3.5 与 3.7。")

    d.h2("3.5　用例关系")
    d.body("九组关系可以归为三类：一组参与者泛化、五组包含、一组扩展，以及两组状态联动。«include» 是「每次都要做」，«extend» 是「有条件才做」，两者不能互换。")
    d.table("表 3-3　用例关系", ["关系", "源 → 目标", "语义", "实现依据"], [
        ["泛化", "学生 → 游客", "学生继承游客的浏览、搜索、详情与注册登录行为", "role 为 user 可访问公开页；前端路由 auth 标记"],
        ["«include»", "发布商品 → 上传商品图片", "每次发布至少 1 张图，上传是必需子行为", "product.publish 校验 images 数量；storage.upload"],
        ["«include»", "发布商品 → 提交审核", "发布成功即进入待审核，没有直接上架入口", "product.publish 固定写 status 为 pending"],
        ["«extend»", "驳回商品 → 审核商品", "审核中的条件分支：不通过并写原因", "admin.moderate 的 pass=false 分支"],
        ["«include»", "提交订单 → 校验库存并锁定商品", "下单必须校验状态、库存与归属，并置为已预订", "order.create 逐件 getProduct 后 update"],
        ["«include»", "提交订单 → 生成订单快照", "订单明细复制标题、价格与图片", "order.items 存快照，商品改价不影响历史订单"],
        ["«extend»", "使用已保存的面交地址 → 提交订单", "有地址簿时可选带出，不是必需步骤", "address.list 与结算页的地址下拉"],
        ["«include»", "确认完成交易 → 商品置为已售出", "双方确认后商品必须转为已售出", "order.confirm 的 bothDone 分支"],
        ["«include»", "取消订单 → 商品恢复在售", "取消后释放仍为已预订的商品", "order.cancel 逐件判断 reserved 后回 on"],
    ], [2.0, 3.8, 5.6, 4.6])
    d.body("把「驳回商品」建模为「审核商品」的扩展而非包含，是因为驳回只在审核不通过时发生；若建成包含，等于说每次审核都必须驳回，语义相反。同理，「使用已保存的面交地址」是下单的可选便利，不是必需步骤，因此由扩展用例指向基用例。")
    d.body("「商品置为已售出」与「商品恢复在售」不是用户主动选择的目标，而是订单状态变化的联动结果。严格说，它们更接近系统内部行为；此处保留为被包含用例，是为了让状态机在模型中可见，便于与代码对照。")

    d.h2("3.6　核心用例规约")
    d.body("以下五份规约覆盖「发布—下单—确认或取消—审核」的关键路径。每份规约都标注服务端接口与业务规则，便于与表 2-2 的劣势条目、表 3-9 的追溯表互相核对。")

    d.body("表 3-4 描述卖家上架商品。发布不是「写入即上架」，而是「写入待审核」，这是审核制的前提。")
    d.table("表 3-4　用例规约：发布商品（UC-08）", ["项目", "内容"], [
        ["参与者", "学生（卖家）"],
        ["目标", "把闲置商品以结构化信息提交上架，进入审核队列"],
        ["前置条件", "已登录；本地至少有 1 张可上传图片"],
        ["触发条件", "在「发布闲置」页提交流程的最后一步"],
        ["主成功场景", "1. 学生填写标题、分类、价格、数量与描述\n2. 上传 1–5 张图片，前端压缩到最长边 900 像素\n3. 前端校验标题 4–40 字、描述不少于 5 字、价格不低于 1 分\n4. 调用 product.publish，服务端再次校验并写入待审核\n5. 返回商品编号与状态，提示「已提交，等待审核」\n6. 商品出现在「我的发布」，不进入首页与搜索"],
        ["扩展场景", "2a. 图片超过 3MB 或格式不支持：前端压缩失败或服务端拒绝，提示换图\n3a. 标题、描述、价格或图片数量不合规：服务端返回具体错误，保留表单\n4a. 未登录或令牌过期：跳转登录，并在登录后回到发布页"],
        ["后置条件", "products 新增一条待审核记录，包含卖家、图片文件标识与时间戳"],
        ["业务规则", "标题 4–40 字；描述不少于 5 字；价格 1–10,000,000 分；图片 1–5 张；库存 1–20"],
        ["涉及接口", "storage.upload（逐张，可选）、product.publish"],
        ["界面入口", "#/publish"],
    ], [2.6, 13.4])

    d.body("表 3-5 描述买家把购物车转为订单。它是全系统状态最多的一步：校验、锁定、快照与清理购物车在同一请求内完成。")
    d.table("表 3-5　用例规约：提交订单（UC-10）", ["项目", "内容"], [
        ["参与者", "学生（买家）"],
        ["目标", "把已选商品转为待面交订单，并锁定库存"],
        ["前置条件", "已登录；购物车中有已勾选且在售的商品；商品不属于自己"],
        ["触发条件", "在结算页点击「确认下单」"],
        ["主成功场景", "1. 前端从会话存储取出结算项，带出默认面交地址\n2. 填写联系人、联系电话与面交地点\n3. 前端校验地点非空、电话为 11 位手机号\n4. 调用 order.create，逐件读取商品并校验归属与状态\n5. 数量夹取到 1 至库存之间，校验所有商品属于同一卖家\n6. 计算合计，生成订单号与明细快照，写入订单\n7. 逐件把商品置为已预订，清理对应购物车条目\n8. 返回订单号，跳转订单页"],
        ["扩展场景", "4a. 商品已下架或被他人预订：提示「已不能购买」并中止\n4b. 商品为自己发布：拒绝并提示\n5a. 跨卖家结算：提示分开下单\n6a. 读取与写入之间被他人下单：当前实现没有条件更新或事务，存在双卖窗口\n7a. 购物车清理失败：不回滚订单，属于非关键异常"],
        ["后置条件", "orders 新增一条待面交订单；products 对应商品变为已预订；carts 对应条目删除"],
        ["业务规则", "不能买自己的商品；只有「在售」可下单；一次只能结算同一卖家；下单即锁定；数量不得超过库存"],
        ["涉及接口", "order.create"],
        ["界面入口", "#/checkout"],
    ], [2.6, 13.4])

    d.body("表 3-6 描述双方确认。它把「交易完成」定义为两个独立确认的与，而不是任一方单独声明。")
    d.table("表 3-6　用例规约：确认完成交易（UC-12）", ["项目", "内容"], [
        ["参与者", "学生（买家或卖家）"],
        ["目标", "记录本人已交付或已收货；双方都确认后结束订单"],
        ["前置条件", "已登录；订单处于待面交；本人是买家或卖家"],
        ["触发条件", "在订单页点击「确认收货」或「确认已交付」"],
        ["主成功场景", "1. 调用 order.confirm，校验订单存在且仍为待面交\n2. 按当前用户置买家确认或卖家确认\n3. 若双方都已确认，订单改为已完成并记录完成时间\n4. 逐件把商品置为已售出\n5. 返回最新订单，界面显示「等待对方确认」或「已完成」"],
        ["扩展场景", "2a. 当前用户不是当事人：提示无权操作\n2b. 订单已结束：提示已经结束\n4a. 商品已被管理员下架：仍置为已售出，造成状态冲突"],
        ["后置条件", "订单可能仍为待面交（单方确认），或变为已完成；商品在双方确认后为已售出"],
        ["业务规则", "买卖双方都确认后订单完成，商品转为已售出"],
        ["涉及接口", "order.confirm"],
        ["界面入口", "#/orders"],
    ], [2.6, 13.4])

    d.body("表 3-7 描述取消。取消不只是改订单状态，还要把仍处于已预订的商品释放回在售。")
    d.table("表 3-7　用例规约：取消订单（UC-13）", ["项目", "内容"], [
        ["参与者", "学生（买家或卖家）"],
        ["目标", "终止尚未完成的订单，并让商品重新可售"],
        ["前置条件", "已登录；订单处于待面交；本人是买家或卖家"],
        ["触发条件", "在订单页点击「取消订单」并确认"],
        ["主成功场景", "1. 调用 order.cancel，校验订单存在、仍为待面交且本人是当事人\n2. 订单改为已取消并记录取消时间\n3. 逐件读取商品，若仍为已预订则改回在售\n4. 返回最新订单，界面展示已取消"],
        ["扩展场景", "2a. 订单已结束：拒绝操作\n3a. 商品已被管理员改为其他状态：不覆盖，只有已预订才回滚"],
        ["后置条件", "订单为已取消；仍处于已预订的商品恢复在售"],
        ["业务规则", "取消后商品自动回到在售"],
        ["涉及接口", "order.cancel"],
        ["界面入口", "#/orders"],
    ], [2.6, 13.4])

    d.body("表 3-8 描述管理员审核。通过、驳回与下架共享同一套状态字段，但前置条件不同。")
    d.table("表 3-8　用例规约：审核商品（UC-14）", ["项目", "内容"], [
        ["参与者", "管理员"],
        ["目标", "决定待审核商品是否上架"],
        ["前置条件", "已登录且角色为管理员；商品存在"],
        ["触发条件", "在管理后台对待审核商品点击「通过」或「驳回」"],
        ["主成功场景", "1. 打开待审核列表，预览商品详情\n2. 选择通过：调用 admin.moderate 的 pass 分支，商品改为在售并清空驳回原因\n3. 或选择驳回：填写不超过 100 字的原因，商品改为未通过\n4. 列表移除该商品，统计数字更新"],
        ["扩展场景", "3a. 驳回未填原因：使用默认原因「内容不符合规范」\n3b. 当前用户不是管理员：提示需要管理员权限\n3c. 商品当前不是待审核：接口仍会执行，可能把已售商品改回在售"],
        ["后置条件", "商品为在售或未通过；驳回原因回显给卖家"],
        ["业务规则", "新发布商品默认待审核；驳回必须给出原因并回显"],
        ["涉及接口", "admin.list、admin.moderate、admin.stats"],
        ["界面入口", "#/admin"],
    ], [2.6, 13.4])

    d.h2("3.7　细化用例图")
    d.body("图 2 与图 3 分别展开交易闭环与发布审核的包含、扩展关系。两张图只保留与当前主题相关的参与者，避免总图的信息密度过高。")
    d.figure(os.path.join("docs", "figs", "fig-swot-usecase-trade.png"), "图 2　交易闭环细化用例图", width_cm=14.6,
             note="注：依据 order.create、order.confirm、order.cancel 的状态流转绘制。")
    d.body("图 2 中，「提交订单」必须包含库存校验与锁定、订单快照两项子行为；「确认完成交易」在双方都确认时把商品置为已售出；「取消订单」把仍为已预订的商品恢复在售。三个用例共同构成订单状态机的全部出口。")
    d.figure(os.path.join("docs", "figs", "fig-swot-usecase-publish.png"), "图 3　商品发布与审核细化用例图", width_cm=14.6,
             note="注：依据 product.publish、storage.upload、admin.moderate 的校验与分支绘制。")
    d.body("图 3 中，发布商品必须包含上传图片与提交审核；驳回是审核的条件扩展。把「提交审核」画成被包含用例，是为了强调发布接口不接受「直接上架」这一状态。")

    d.h2("3.8　用例与实现追溯")
    d.body("追溯表把用例映射到服务端 Action、前端入口与现有自动化检查。标记「部分」表示该用例只在某一条分支或某个页面被覆盖，不代表完整验证。")
    d.table("表 3-9　用例与实现追溯", ["用例", "服务端 Action", "前端入口", "自动化覆盖"], [
        ["UC-01 浏览商品列表", "product.list", "#/", "前端集成：首页渲染与分类筛选"],
        ["UC-02 搜索商品", "product.list（keyword）", "#/search", "后端：搜索分词与命中；前端：搜索结果页"],
        ["UC-03 查看商品详情", "product.detail", "#/p/:id", "前端集成：详情页、登录后可见联系方式"],
        ["UC-04 注册账号", "auth.register", "#/login", "后端：注册校验；前端：注册表单"],
        ["UC-05 登录", "auth.login、auth.me", "#/login", "后端：登录；前端：登录拦截与回跳"],
        ["UC-06 维护个人信息", "user.update", "#/me/edit", "前端集成：个人中心与资料编辑"],
        ["UC-07 管理面交地址", "address.list / save / remove", "#/me/address", "部分：前端地址簿；后端缺独立边界用例"],
        ["UC-08 发布商品", "product.publish、storage.upload", "#/publish", "后端：发布与审核；前端：发布校验"],
        ["UC-09 管理购物车", "cart.list / add / update / remove", "#/cart", "后端：购物车；前端：加购与数量调整"],
        ["UC-10 提交订单", "order.create", "#/checkout", "后端：下单；前端：结算流程"],
        ["UC-11 查看订单", "order.list、order.detail", "#/orders", "部分：前端订单页；后端详情覆盖有限"],
        ["UC-12 确认完成交易", "order.confirm", "#/orders", "后端：双方确认；前端：订单操作按钮"],
        ["UC-13 取消订单", "order.cancel", "#/orders", "后端：取消回滚；前端：订单页"],
        ["UC-14 审核商品", "admin.list、admin.moderate", "#/admin", "后端：驳回；前端：管理后台"],
        ["UC-15 下架违规商品", "admin.takedown", "#/admin", "部分：前端管理后台；后端缺状态边界用例"],
        ["UC-16 查看平台统计", "admin.stats", "#/admin", "前端集成：统计看板"],
    ], [3.2, 4.6, 3.0, 5.2])
    d.body("从覆盖看，浏览、搜索、发布、购物车、下单、确认、取消与审核都有直接检查；个人信息、地址、下架与统计主要靠前端集成测试覆盖，缺少服务端边界用例。这是测试结构上的空白，不是功能缺失。")

    d.h2("3.9　建模结论")
    d.body("模型整体闭合，但边界处有四处缺口。第一，账号生命周期不完整：有注册与登录，没有找回密码、修改密码与注销，UC-04 与 UC-05 的成功路径在真实运营中会被账号丢失打断。第二，治理链路缺一环：只有管理员主动审核与下架，没有面向学生的举报与面向卖家的申诉，UC-14 的驳回无法被复议。")
    d.body("第三，系统事件没有用例承载：预订即将超时、订单完成、商品被驳回都依赖用户主动查看，缺少「发送通知」这一由时间或状态变化触发的用例。第四，管理端用例的前置状态未在接口层强制：UC-14 与 UC-15 的规约要求商品处于待审核或在售，代码却允许对任意状态执行，模型与实现不一致。")
    d.body("建议下一版补三个用例：找回密码、举报商品、发送交易通知；并把「超时释放预订」建模为时间触发的系统用例。四项都不需要引入支付，属于低成本、高收益的补强。")


def chapter4(d):
    d.h1("4　结论与建议")
    d.h2("4.1　主要结论")
    d.body("SWOT 的净判断是：优势足以支撑一个小范围试点，但不足以支撑自然增长。低成本与可追溯让平台在「一个学院、一栋宿舍楼」的密度内跑得通；一旦离开熟人密度，身份、信用与治理的缺口会迅速放大。")
    d.body("用例模型的价值不在图，而在暴露边界：16 个用例覆盖了从发布到完成的全部用户目标，但账号自救、举报申诉与通知三类用例缺失，说明系统仍按「功能清单」而非「用户生命周期」组织。")
    d.body("因此建议把资源集中在四处：把沟通留在站内、把预订变成有期限的承诺、把管理员从单点变成可审计的角色、把个人信息处理做成可告知可删除的流程。这四件事完成后，再考虑评价、身份核验与多校复制。")

    d.h2("4.2　改进路线")
    d.body("表 4-1 把建议落到可验收的动作。P0 的五项在推广前完成；P1 的三项在试点稳定后补；P2 的多校与小程序能力放在最后。")
    d.table("表 4-1　改进路线与验收标准", ["优先级", "改进项", "对应问题", "验收标准"], [
        ["P0", "商品留言与举报", "W1、W8、T4", "买卖双方可在站内完成至少 3 轮问答；举报在 24 小时内有状态；联系方式默认脱敏"],
        ["P0", "预订超时释放与关键节点通知", "W3、W7", "预订超过 48 小时未确认自动回在售；下单、驳回、完成三类事件可触达"],
        ["P0", "下单原子化与状态守卫", "W4", "并发 20 次下单同一商品仅 1 单成功；管理端拒绝非法状态迁移"],
        ["P0", "隐私最小化与账号注销", "W1、W2、T3", "提供隐私告知与同意；支持注销并删除个人数据；日志脱敏"],
        ["P0", "管理员权限、审计与密钥轮换", "W8、T5", "审核与下架写审计日志；启动时强制检查 TOKEN_SECRET 与 ADMIN_CODE"],
        ["P1", "校园身份核验与评价", "W2、T2", "学号可对接学校名册或人工抽检；完成订单可互评"],
        ["P1", "搜索索引与结果上限", "W5", "万级商品下搜索总数准确，P95 响应低于 500 毫秒"],
        ["P1", "图片 CDN、缩略图与直传", "W6", "列表图不超过 100KB；上传不再经过云函数内存"],
        ["P2", "小程序入口与多校隔离", "O3、O4", "小程序可分享商品卡片；多校数据按 school 隔离"],
    ], [1.6, 5.2, 3.8, 5.4], aligns=[WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT])
    d.body("排序依据不是工作量，而是风险：P0 中的站内沟通、超时释放、下单原子化与隐私注销，分别对应 W1、W3、W4、T3，任何一项缺失都会让试点数据失真。P1 的身份核验与评价，只有在订单量足以支撑信用积累时才有意义。")

    d.h2("4.3　局限")
    d.body("本报告基于代码静态审阅与项目文档，没有真实用户访谈、转化数据或压力测试；外部市场数据为年度口径，不能替代单校调研。SWOT 中的机会与威胁是条件判断，不是预测；用例规约描述 V1 行为，新增用例属于建议而非现状。若后续代码变更，接口与状态机部分需重新核对。")


def references(d):
    d.h1("参考文献")
    d.body("[1] 网经社电子商务研究中心：《2025年度中国网络零售市场数据报告》，网经社，2026 年 6 月 10 日，http://www.100ec.cn/detail--6660066.html（访问日期：2026 年 11 月 24 日）。", indent=False)
    d.body("[2] 大众日报：《“二手青年”重塑生活经济学》，新华网山东频道，2025 年 12 月 29 日，http://www.sd.news.cn/20251229/2c3829d61b1242a78343e78a23e4d728/c.html（访问日期：2026 年 11 月 24 日）。", indent=False)
    d.body("[3] 36氪：《小红书做二手、闲鱼做内容社区，互联网尽头是跨界“偷塔”？》，2025 年 11 月 11 日，https://36kr.com/p/3547232238442632（访问日期：2026 年 11 月 24 日）。", indent=False)


def appendix(d):
    d.h1("附录 A　术语表")
    d.table("表 A-1　术语与缩略语", ["术语", "含义"], [
        ["参与者（Actor）", "与系统交互并追求目标的外部角色，放在系统边界之外"],
        ["用例（Use Case）", "参与者为达成一个完整目标而执行的一组系统行为"],
        ["«include»", "基用例每次执行都必然调用的子行为，箭头指向被包含用例"],
        ["«extend»", "在特定条件下才发生的扩展行为，箭头指向基用例"],
        ["泛化（Generalization）", "子类型继承父类型的行为，空心三角指向父类型"],
        ["主成功场景", "所有条件正常时的步骤序列"],
        ["扩展场景", "条件分支、异常与失败处理"],
        ["TOWS", "由 SWOT 四象限交叉推导出的行动策略，分为 SO、WO、ST、WT"],
        ["面交", "买卖双方线下约定地点当面交付并付款，平台不参与结算"],
        ["快照", "订单创建时复制的商品标题、价格与图片，后续商品变更不影响历史订单"],
    ], [4.4, 11.6])


def build(out_path):
    d = Doc()
    cover(d)
    d.toc()
    d.body_section()
    abstract(d)
    chapter1(d)
    chapter2(d)
    chapter3(d)
    chapter4(d)
    references(d)
    appendix(d)
    d.doc.core_properties.title = "校园集市 SWOT 分析与 UML 用例建模"
    d.doc.core_properties.author = "校园集市项目组"
    d.doc.core_properties.subject = "软件系统分析报告"
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    d.doc.save(out_path)
    print("saved:", os.path.abspath(out_path))


def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base, "docs", "《SWOT分析与UML用例建模》.docx")
    build(out)


if __name__ == "__main__":
    main()
