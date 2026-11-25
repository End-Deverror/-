# -*- coding: utf-8 -*-
"""绘制《SWOT 分析与 UML 用例建模》中的三张用例图。

输出：
    docs/figs/fig-swot-usecase-system.png     系统总用例图
    docs/figs/fig-swot-usecase-trade.png      交易闭环细化用例图
    docs/figs/fig-swot-usecase-publish.png    商品发布与审核细化用例图

复用 tools/draw_usecase.py 里的绘制原语，保持与项目既有配图同一套线宽与字体。
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image, ImageDraw  # noqa: E402

import draw_usecase as du  # noqa: E402

WHITE = (255, 255, 255)
INK = du.INK


def fig_system(out_path):
    W, H = 2400, 1950
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)

    du.boundary(d, 360, 95, 1960, 1840, "校园集市系统（V1）")

    UC_W, UC_H = 330, 100

    defs = {
        # 游客 / 学生共用（学生继承游客）
        "browse": (650, 230, "浏览商品列表"),
        "search": (650, 370, "搜索商品"),
        "detail": (650, 510, "查看商品详情"),
        "register": (650, 650, "注册账号"),
        "login": (650, 790, "登录"),
        # 学生专属
        "profile": (1040, 830, "维护个人信息"),
        "address": (1040, 960, "管理面交地址"),
        "publish": (1040, 1090, "发布商品"),
        "cart": (1040, 1220, "管理购物车"),
        "order": (1040, 1350, "提交订单"),
        "vieworder": (1040, 1480, "查看订单"),
        "confirm": (1040, 1610, "确认完成交易"),
        "cancel": (1040, 1740, "取消订单"),
        # 管理员
        "audit": (1640, 720, "审核商品"),
        "takedown": (1640, 860, "下架违规商品"),
        "stats": (1640, 1000, "查看平台统计"),
    }
    ucs = {}
    for key, (cx, cy, text) in defs.items():
        ucs[key] = {"cx": cx, "cy": cy, "text": text}
        du.draw_usecase(d, cx, cy, UC_W, UC_H, text, fs=36)

    # 两个左侧角色同轴上下排列，泛化线沿两腿之间的空隙上行，箭头落在游客脚下
    guest = du.draw_actor(d, 180, 380, "游客", fs=42, label_pos="top")
    student = du.draw_actor(d, 180, 1280, "学生", fs=42)
    admin = du.draw_actor(d, 2120, 880, "管理员", fs=42)

    for key in ("browse", "search", "detail", "register", "login"):
        u = ucs[key]
        du.assoc(d, guest, u["cx"], u["cy"], UC_W, UC_H)

    for key in ("profile", "address", "publish", "cart", "order", "vieworder", "confirm", "cancel"):
        u = ucs[key]
        du.assoc(d, student, u["cx"], u["cy"], UC_W, UC_H)

    for key in ("audit", "takedown", "stats"):
        u = ucs[key]
        du.assoc(d, admin, u["cx"], u["cy"], UC_W, UC_H)

    # 学生 继承 游客：空心三角指向父角色
    sx, sy = student["cx"], student["fig_top"] - 6
    tx, ty = guest["cx"], guest["fig_bottom"] + 8
    d.line([sx, sy, tx, ty], fill=INK, width=3)
    ang = math.atan2(ty - sy, tx - sx)
    du.hollow_triangle(d, (tx, ty), ang)

    img.save(out_path)
    print("saved", out_path, img.size)


def fig_trade(out_path):
    W, H = 1900, 1020
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)

    du.boundary(d, 320, 85, 1500, 930, "交易闭环")

    UC_W, UC_H = 340, 100
    pos = {
        "order": (600, 300, "提交订单"),
        "confirm": (600, 540, "确认完成交易"),
        "cancel": (600, 780, "取消订单"),
        "lock": (1120, 230, "校验库存并锁定商品"),
        "snapshot": (1120, 390, "生成订单快照"),
        "sold": (1120, 540, "商品置为已售出"),
        "restore": (1120, 780, "商品恢复在售"),
    }
    ucs = {}
    for key, (cx, cy, text) in pos.items():
        ucs[key] = {"cx": cx, "cy": cy, "text": text}
        du.draw_usecase(d, cx, cy, UC_W, UC_H, text, fs=34)

    student = du.draw_actor(d, 150, 540, "学生", fs=40)
    for key in ("order", "confirm", "cancel"):
        u = ucs[key]
        du.assoc(d, student, u["cx"], u["cy"], UC_W, UC_H)

    du.relation(d, ucs["order"], ucs["lock"], "include", "«include»", UC_W, UC_H, fs=30)
    du.relation(d, ucs["order"], ucs["snapshot"], "include", "«include»", UC_W, UC_H, fs=30)
    du.relation(d, ucs["confirm"], ucs["sold"], "include", "«include»", UC_W, UC_H, fs=30)
    du.relation(d, ucs["cancel"], ucs["restore"], "include", "«include»", UC_W, UC_H, fs=30)

    img.save(out_path)
    print("saved", out_path, img.size)


def fig_publish(out_path):
    W, H = 1800, 1010
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)

    du.boundary(d, 300, 85, 1450, 930, "商品发布与审核")

    UC_W, UC_H = 330, 100
    pos = {
        "publish": (520, 330, "发布商品"),
        "upload": (1000, 230, "上传商品图片"),
        "submit": (1000, 410, "提交审核"),
        "reject": (680, 650, "驳回商品"),
        "audit": (1150, 650, "审核商品"),
    }
    ucs = {}
    for key, (cx, cy, text) in pos.items():
        ucs[key] = {"cx": cx, "cy": cy, "text": text}
        du.draw_usecase(d, cx, cy, UC_W, UC_H, text, fs=36)

    student = du.draw_actor(d, 150, 330, "学生", fs=40)
    admin = du.draw_actor(d, 1680, 650, "管理员", fs=40)

    du.assoc(d, student, ucs["publish"]["cx"], ucs["publish"]["cy"], UC_W, UC_H)
    du.assoc(d, admin, ucs["audit"]["cx"], ucs["audit"]["cy"], UC_W, UC_H)

    du.relation(d, ucs["publish"], ucs["upload"], "include", "«include»", UC_W, UC_H, fs=30)
    du.relation(d, ucs["publish"], ucs["submit"], "include", "«include»", UC_W, UC_H, fs=30)
    du.relation(d, ucs["reject"], ucs["audit"], "extend", "«extend»", UC_W, UC_H, fs=30)

    img.save(out_path)
    print("saved", out_path, img.size)


def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(base, "docs", "figs")
    os.makedirs(out_dir, exist_ok=True)
    fig_system(os.path.join(out_dir, "fig-swot-usecase-system.png"))
    fig_trade(os.path.join(out_dir, "fig-swot-usecase-trade.png"))
    fig_publish(os.path.join(out_dir, "fig-swot-usecase-publish.png"))


if __name__ == "__main__":
    main()
