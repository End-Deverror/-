# -*- coding: utf-8 -*-
"""生成《软件系统设计报告》.docx。

用法（在项目根目录）：
    <python> tools/build_report.py [输出路径]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from report_lib import Report  # noqa: E402
import report_content  # noqa: E402


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join("docs", "《软件系统设计报告》.docx")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)

    r = Report()
    r.enable_header("《软件系统设计报告》· 校园集市")
    r.enable_footer()
    report_content.build(r)
    r.save(out)

    print("saved:", os.path.abspath(out))


if __name__ == "__main__":
    main()
