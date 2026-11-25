# -*- coding: utf-8 -*-
"""用 Pillow 画 UML 用例图。

输出：
    docs/figs/fig-usecase-overview.png   系统总用例图
    docs/figs/fig-usecase-detail.png     商品发布与审核的细化用例图

画法说明：图在 2200px 宽的画布上绘制，插入 Word 时缩到 15.4cm，
因此 44px 的字约等于 9.3pt，与正文 10.5pt 的表格字号相称。
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

FONT_REG = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
INK = (26, 29, 33)
GRAY = (110, 118, 128)
WHITE = (255, 255, 255)
LABEL_BG = (250, 250, 251)

_font_cache = {}


def font(size, bold=False):
    key = (size, bold)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
    return _font_cache[key]


def text_w(d, s, f):
    return d.textlength(s, font=f)


def draw_actor(d, x, y, name, fs=42, label_pos="bottom"):
    """火柴人：返回图形与文字各自的包围盒。

    fig_top/fig_bottom 用来连泛化线，mid 用来连关联线——都只算图形，不含名字，
    否则连接点会被名字拉偏，出现斜线穿框。
    label_pos="top" 时名字画在头顶，用于角色下方还有连线（泛化箭头）的场景。
    """
    r = 26
    head_top = y - r
    d.ellipse([x - r, head_top, x + r, head_top + 2 * r], outline=INK, width=3)
    body_top = head_top + 2 * r
    body_bottom = body_top + 78
    d.line([x, body_top, x, body_bottom], fill=INK, width=3)
    d.line([x - 54, body_top + 30, x + 54, body_top + 30], fill=INK, width=3)
    d.line([x, body_bottom, x - 44, body_bottom + 62], fill=INK, width=3)
    d.line([x, body_bottom, x + 44, body_bottom + 62], fill=INK, width=3)
    feet = body_bottom + 62

    f = font(fs)
    lines = name.split("\n")
    widths = [text_w(d, ln, f) for ln in lines]
    if label_pos == "top":
        top = head_top - len(lines) * (fs + 8) - 10
    else:
        top = feet + 16
    for i, ln in enumerate(lines):
        d.text((x - widths[i] / 2, top + i * (fs + 8)), ln, font=f, fill=INK)

    return {
        "cx": x,
        "left": x - 60,
        "right": x + 60,
        "mid": body_top + 30,
        "fig_top": head_top,
        "fig_bottom": feet,
    }


def wrap_lines(d, text, f, max_w):
    """按字符宽度折行（中文按字断行即可）。"""
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        trial = cur + ch
        if text_w(d, trial, f) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def draw_usecase(d, cx, cy, w, h, text, fs=40):
    d.ellipse([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], outline=INK, width=3, fill=WHITE)
    f = font(fs)
    lines = wrap_lines(d, text, f, w - 56)
    line_h = fs + 8
    start_y = cy - (len(lines) * line_h) / 2 + 2
    for i, ln in enumerate(lines):
        tw = text_w(d, ln, f)
        d.text((cx - tw / 2, start_y + i * line_h), ln, font=f, fill=INK)
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def ellipse_edge(cx, cy, w, h, tx, ty):
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    a, b = w / 2, h / 2
    t = 1.0 / math.sqrt((dx / a) ** 2 + (dy / b) ** 2)
    return cx + dx * t, cy + dy * t


def dashed_line(d, p1, p2, fill=INK, width=3, dash=16, gap=10):
    x1, y1 = p1
    x2, y2 = p2
    total = math.hypot(x2 - x1, y2 - y1)
    if total == 0:
        return
    ux, uy = (x2 - x1) / total, (y2 - y1) / total
    pos = 0.0
    while pos < total:
        end = min(pos + dash, total)
        d.line([x1 + ux * pos, y1 + uy * pos, x1 + ux * end, y1 + uy * end], fill=fill, width=width)
        pos = end + gap


def open_arrow(d, p_from, p_to, fill=INK, size=22):
    """开口箭头，箭头尖在 p_to。"""
    x1, y1 = p_from
    x2, y2 = p_to
    ang = math.atan2(y2 - y1, x2 - x1)
    for delta in (math.radians(150), math.radians(-150)):
        d.line([x2, y2, x2 + size * math.cos(ang + delta), y2 + size * math.sin(ang + delta)],
               fill=fill, width=3)


def hollow_triangle(d, tip, angle, size=26):
    """空心三角箭头（泛化关系）。"""
    x, y = tip
    pts = [
        (x, y),
        (x - size * math.cos(angle - math.radians(26)), y - size * math.sin(angle - math.radians(26))),
        (x - size * math.cos(angle + math.radians(26)), y - size * math.sin(angle + math.radians(26))),
    ]
    d.polygon(pts, fill=WHITE, outline=INK)
    d.line([pts[0], pts[1]], fill=INK, width=3)
    d.line([pts[0], pts[2]], fill=INK, width=3)


def assoc(d, actor, uc_cx, uc_cy, uc_w, uc_h):
    ax = actor["right"] if uc_cx > actor["cx"] else actor["left"]
    ay = actor["mid"]
    ex, ey = ellipse_edge(uc_cx, uc_cy, uc_w, uc_h, ax, ay)
    d.line([ax, ay, ex, ey], fill=INK, width=3)


def relation(d, from_uc, to_uc, kind, label, w, h, fs=34):
    """from_uc -> to_uc 的依赖关系（虚线 + 开口箭头 + 标签）。"""
    fx, fy = from_uc["cx"], from_uc["cy"]
    tx, ty = to_uc["cx"], to_uc["cy"]
    sx, sy = ellipse_edge(fx, fy, w, h, tx, ty)
    ex, ey = ellipse_edge(tx, ty, w, h, fx, fy)
    # 两端各留一点空隙，避免压住椭圆边框
    mx, my = (sx + ex) / 2, (sy + ey) / 2
    dashed_line(d, (sx, sy), (mx, my), width=3)
    dashed_line(d, (mx, my), (ex, ey), width=3)

    ang = math.atan2(ey - sy, ex - sx)
    d.line([ex, ey, ex - 24 * math.cos(ang + math.radians(0.35)), ey - 24 * math.sin(ang + math.radians(0.35))],
           fill=INK, width=3)
    d.line([ex, ey, ex - 24 * math.cos(ang - math.radians(0.35)), ey - 24 * math.sin(ang - math.radians(0.35))],
           fill=INK, width=3)

    f = font(fs)
    tw = text_w(d, label, f)
    # 标签沿连线法线方向偏移，避免压在虚线或椭圆边上
    if math.hypot(ex - sx, ey - sy) > 0:
        nx = -(ey - sy) / math.hypot(ex - sx, ey - sy)
        ny = (ex - sx) / math.hypot(ex - sx, ey - sy)
    else:
        nx, ny = 0, -1
    if ny > 0:
        nx, ny = -nx, -ny
    lx = mx + nx * 30 - tw / 2
    ly = my + ny * 30 - fs / 2
    d.rectangle([lx - 8, ly - 4, lx + tw + 8, ly + fs + 10], fill=LABEL_BG)
    d.text((lx, ly), label, font=f, fill=GRAY)


def boundary(d, x1, y1, x2, y2, title, fs=42):
    d.rectangle([x1, y1, x2, y2], outline=INK, width=3)
    f = font(fs, bold=True)
    tw = text_w(d, title, f)
    d.rectangle([(x1 + x2) / 2 - tw / 2 - 14, y1 + 8, (x1 + x2) / 2 + tw / 2 + 14, y1 + fs + 26], fill=WHITE)
    d.text(((x1 + x2) / 2 - tw / 2, y1 + 12), title, font=f, fill=INK)


# ============ 图 1：系统总用例图 ============
def fig_overview(out_path):
    W, H = 2200, 1620
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)

    boundary(d, 470, 90, 1880, 1560, "校园集市系统")

    UC_W, UC_H = 360, 104

    defs = {
        "browse": (760, 250, "浏览商品列表"),
        "search": (760, 400, "搜索商品"),
        "detail": (760, 550, "查看商品详情"),
        "register": (1180, 700, "注册 / 登录"),
        "publish": (1180, 840, "发布商品"),
        "cart": (1180, 980, "管理购物车"),
        "order": (1180, 1120, "提交订单"),
        "confirm": (1180, 1260, "确认完成交易"),
        "profile": (1180, 1400, "维护个人信息"),
        "audit": (1660, 470, "审核商品"),
        "takedown": (1660, 630, "下架违规商品"),
        "stats": (1660, 790, "查看平台统计"),
    }
    ucs = {}
    for key, (cx, cy, text) in defs.items():
        ucs[key] = {"cx": cx, "cy": cy, "text": text}
        draw_usecase(d, cx, cy, UC_W, UC_H, text)

    guest = draw_actor(d, 200, 400, "游客", fs=42, label_pos="top")
    student = draw_actor(d, 200, 1050, "学生", fs=42)
    admin = draw_actor(d, 2030, 630, "管理员", fs=42)

    for key in ("browse", "search", "detail"):
        u = ucs[key]
        assoc(d, guest, u["cx"], u["cy"], UC_W, UC_H)
    for key in ("register", "publish", "cart", "order", "confirm", "profile"):
        u = ucs[key]
        assoc(d, student, u["cx"], u["cy"], UC_W, UC_H)
    for key in ("audit", "takedown", "stats"):
        u = ucs[key]
        assoc(d, admin, u["cx"], u["cy"], UC_W, UC_H)

    # 学生 继承 游客：从学生头顶连到游客脚下，三角箭头指向父角色
    sx = student["cx"]
    d.line([sx, student["fig_top"] - 6, sx, guest["fig_bottom"] + 6], fill=INK, width=3)
    hollow_triangle(d, (sx, guest["fig_bottom"] + 6), -math.pi / 2)

    img.save(out_path)
    print("saved", out_path, img.size)


# ============ 图 2：发布与审核细化用例图 ============
def fig_detail(out_path):
    W, H = 1800, 980
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)

    boundary(d, 300, 90, 1340, 900, "商品发布与审核")

    UC_W, UC_H = 330, 100

    pos = {
        "publish": (560, 350, "发布商品"),
        "upload": (960, 250, "上传商品图片"),
        "submit": (960, 430, "提交审核"),
        "audit": (560, 720, "审核商品"),
        "reject": (960, 620, "驳回商品"),
    }
    ucs = {}
    for key, (cx, cy, text) in pos.items():
        ucs[key] = {"cx": cx, "cy": cy, "text": text}
        draw_usecase(d, cx, cy, UC_W, UC_H, text)

    student = draw_actor(d, 150, 350, "学生", fs=38)
    admin = draw_actor(d, 1620, 638, "管理员", fs=38)

    assoc(d, student, ucs["publish"]["cx"], ucs["publish"]["cy"], UC_W, UC_H)
    assoc(d, admin, ucs["audit"]["cx"], ucs["audit"]["cy"], UC_W, UC_H)

    relation(d, ucs["publish"], ucs["upload"], "include", "«include»", UC_W, UC_H)
    relation(d, ucs["publish"], ucs["submit"], "include", "«include»", UC_W, UC_H)
    relation(d, ucs["reject"], ucs["audit"], "extend", "«extend»", UC_W, UC_H)

    img.save(out_path)
    print("saved", out_path, img.size)


def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(base, "docs", "figs")
    os.makedirs(out_dir, exist_ok=True)
    fig_overview(os.path.join(out_dir, "fig-usecase-overview.png"))
    fig_detail(os.path.join(out_dir, "fig-usecase-detail.png"))


if __name__ == "__main__":
    main()
