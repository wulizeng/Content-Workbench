# -*- coding: utf-8 -*-
"""售后挽单 PRD 配图：依据当前页面真实字段与 mock 数据绘制的流程/布局示意图"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(os.path.abspath(__file__))
FONT = '/System/Library/Fonts/PingFang.ttc'
C = dict(primary='#5b6cf5', primary_dark='#4a5ae8', ink='#0f172a', sub='#475569', muted='#64748b',
         faint='#94a3b8', border='#e2e8f0', bg='#f6f7fb', white='#ffffff',
         green='#059669', green_bg='#ecfdf5', green_bd='#a7f3d0',
         blue='#2563eb', blue_bg='#dbeafe', blue_bd='#bfdbfe',
         amber='#d97706', amber_bg='#fffbeb', amber_bd='#fde68a',
         red='#dc2626', red_bg='#fef2f2', red_bd='#fecaca',
         slate_bg='#f1f5f9', indigo_bg='#eef0ff', indigo_bd='#c7cdf9', orange='#ea580c', orange_bg='#fff7ed', orange_bd='#fed7aa')

def f(size, bold=False):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)

def canvas(w, h, title=None, sub=None):
    im = Image.new('RGB', (w, h), C['bg'])
    d = ImageDraw.Draw(im)
    if title:
        d.rectangle([0, 0, w, 74], fill=C['white'])
        d.line([0, 74, w, 74], fill=C['border'], width=2)
        d.rectangle([0, 0, 8, 74], fill=C['primary'])
        txt(d, 30, 37, title, 28, C['ink'], True, 'lm')
        if sub:
            txt(d, w - 30, 37, sub, 18, C['muted'], False, 'rm')
    return im, d

def txt(d, x, y, s, size=20, color=None, bold=False, anchor='la'):
    d.text((x, y), s, font=f(size, bold), fill=color or C['ink'], anchor=anchor)

def rr(d, box, r=12, fill=None, outline=None, width=2):
    d.rounded_rectangle(box, radius=r, fill=fill or C['white'], outline=outline, width=width)

def tw(s, size, bold=False):
    return f(size, bold).getlength(s)

def chip(d, x, y, s, fg, bg, bd=None, size=18, pad=12, h=34):
    w = tw(s, size) + pad * 2
    rr(d, [x, y, x + w, y + h], h // 2, bg, bd, 2)
    txt(d, x + w / 2, y + h / 2, s, size, fg, True, 'mm')
    return w

def arrow(d, x1, y1, x2, y2, color=None, width=3, head=10):
    color = color or C['faint']
    d.line([x1, y1, x2, y2], fill=color, width=width)
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    for da in (2.6, -2.6):
        d.line([x2, y2, x2 - head * math.cos(ang + da * 0.4), y2 - head * math.sin(ang + da * 0.4)], fill=color, width=width)

def cell_text(d, x, y, w, h, val, size=17):
    """val: str 或 (text, color, bold)"""
    if isinstance(val, tuple):
        s, color, bold = val
    else:
        s, color, bold = val, C['sub'], False
    txt(d, x + w / 2, y + h / 2, s, size, color, bold, 'mm')

def table(d, x, y, widths, rows, row_h=42, header=True, size=17, aligns=None):
    W = sum(widths)
    for ri, row in enumerate(rows):
        yy = y + ri * row_h
        if header and ri == 0:
            d.rectangle([x, yy, x + W, yy + row_h], fill=C['indigo_bg'])
        elif ri % 2 == 0:
            d.rectangle([x, yy, x + W, yy + row_h], fill='#fafbfe')
        xx = x
        for ci, val in enumerate(row):
            if isinstance(val, tuple) and len(val) == 4:  # (text,color,bold,bg)
                s, color, bold, bg = val
                if bg:
                    d.rectangle([xx + 2, yy + 5, xx + widths[ci] - 2, yy + row_h - 5], fill=bg)
                cell_text(d, xx, yy, widths[ci], row_h, (s, color, bold), size)
            else:
                cell_text(d, xx, yy, widths[ci], row_h, val if not (header and ri == 0) else (val, C['sub'], True), size)
            xx += widths[ci]
        d.line([x, yy + row_h, x + W, yy + row_h], fill=C['border'], width=1)
    d.rectangle([x, y, x + W, y + len(rows) * row_h], outline=C['border'], width=2)
    xx = x
    for wdt in widths[:-1]:
        xx += wdt
        d.line([xx, y, xx, y + len(rows) * row_h], fill=C['border'], width=1)
    return y + len(rows) * row_h

def btn(d, x, y, label, primary=False, w=None, h=40, size=18):
    w = w or tw(label, size) + 36
    rr(d, [x, y, x + w, y + h], 9, C['primary'] if primary else C['white'], None if primary else C['border'], 2)
    txt(d, x + w / 2, y + h / 2, label, size, C['white'] if primary else C['sub'], True, 'mm')
    return w

def save(im, name):
    p = os.path.join(OUT, name)
    im.save(p)
    print('saved', name, im.size)

# ============ 图1 整体业务流程 ============
def fig_flow():
    im, d = canvas(1600, 1160, '售后挽单 · 整体业务流程', '两段式数据链路 + 周度批处理节奏')
    steps = [
        ('① 大数据全局商品池（周度快照）', '(店铺, 款) 为主键 · 产出销售 / 退货率 / 毛利率指标与候选资格，不下「是否挽单」结论', C['blue'], C['blue_bg'], C['blue_bd']),
        ('② 店铺商品判定策略（一店一策略）', '三维进池判定「是否挽单」：商品中类 → 销售件数 → 退货率倍数；毛利率只定档（低 / 中 / 高）', C['primary'], C['indigo_bg'], C['indigo_bd']),
        ('③ 挽单商品池（店铺级结果表）', '逐款展示 是否挽单 / 分档 / 判定策略；支持人工补录、批量导入、导出与判据追溯', C['primary'], C['indigo_bg'], C['indigo_bd']),
        ('④ 按「店铺 × 分档」自动生成挽单方案', '一店多档生成多个方案 · 商品范围 = 该分档挽单商品 · 退款规则 = 分档退款比例与最高退款金额', C['green'], C['green_bg'], C['green_bd']),
        ('⑤ 同步抖店（配置执行）', '人工照抄方案配置到抖店并回填平台方案ID；同一方案编号原地更新，不重复新建', C['amber'], C['amber_bg'], C['amber_bd']),
        ('⑥ 回读校验与失败处置', '校验商品清单与退款参数一致；失败冻结下周发布，支持单条 / 全部重试与批次回滚', C['green'], C['green_bg'], C['green_bd']),
    ]
    x0, x1, y = 60, 1010, 110
    bh, gap = 118, 40
    for i, (t, s, fg, bg, bd) in enumerate(steps):
        rr(d, [x0, y, x1, y + bh], 14, bg, bd, 2)
        d.rectangle([x0, y, x0 + 8, y + bh], fill=fg)
        txt(d, x0 + 30, y + 30, t, 24, C['ink'], True)
        txt(d, x0 + 30, y + 74, s, 18, C['sub'])
        if i < len(steps) - 1:
            arrow(d, (x0 + x1) / 2, y + bh + 4, (x0 + x1) / 2, y + bh + gap - 4, C['primary'], 3)
        y += bh + gap
    # 右侧节奏
    rx0, rx1 = 1060, 1540
    rr(d, [rx0, 110, rx1, 700], 14, C['white'], C['border'], 2)
    txt(d, rx0 + 26, 140, '周度批处理节奏', 23, C['ink'], True)
    d.line([rx0 + 26, 176, rx1 - 26, 176], fill=C['border'], width=2)
    beats = [
        ('周一 02:00', '指标快照生成', '销量 / 退货 / 毛利指标与候选资格'),
        ('周一 04:00', '挽单判定 + 方案生成', '按店铺策略逐款判定并分档，正推生成方案'),
        ('周三 10:00', '回读校验', '平台商品清单与退款参数一致性比对'),
    ]
    yy = 200
    for i, (t, name, note) in enumerate(beats):
        d.ellipse([rx0 + 30, yy + 6, rx0 + 44, yy + 20], fill=C['primary'])
        if i < len(beats) - 1:
            d.line([rx0 + 37, yy + 22, rx0 + 37, yy + 106], fill=C['indigo_bd'], width=2)
        txt(d, rx0 + 60, yy, t, 19, C['primary'], True)
        txt(d, rx0 + 60, yy + 32, name, 20, C['ink'], True)
        txt(d, rx0 + 60, yy + 64, note, 16, C['muted'])
        yy += 104
    d.line([rx0 + 26, 520, rx1 - 26, 520], fill=C['border'], width=2)
    txt(d, rx0 + 26, 545, '同步平台状态（对外枚举）', 20, C['ink'], True)
    xx = rx0 + 26
    for s, fg, bg, bd in [('待同步', C['amber'], C['amber_bg'], C['amber_bd']), ('同步中', C['blue'], C['blue_bg'], C['blue_bd']),
                          ('同步成功', C['green'], C['green_bg'], C['green_bd']), ('同步失败', C['red'], C['red_bg'], C['red_bd'])]:
        xx += chip(d, xx, 580, s, fg, bg, bd, 16, 10, 32) + 10
    txt(d, rx0 + 26, 630, '由物理方案回读情况聚合推导；仅同步失败时', 16, C['muted'])
    txt(d, rx0 + 26, 658, '「同步失败原因」非空，其余状态显示空白。', 16, C['muted'])
    rr(d, [rx0, 724, rx1, 1018], 14, C['white'], C['border'], 2)
    txt(d, rx0 + 26, 754, '方案生成口径（店铺 × 分档）', 20, C['ink'], True)
    d.line([rx0 + 26, 788, rx1 - 26, 788], fill=C['border'], width=2)
    for i, s in enumerate(['一店多档挽单商品 → 生成多个方案', '商品范围 = 该分档挽单商品平台链接',
                           '退款规则 = 分档退款比例与最高退款金额', '编号 WD+批次日期+3位流水（高→中→低）']):
        txt(d, rx0 + 30, 810 + i * 44, '· ' + s, 17, C['sub'])
    rr(d, [60, y + 6, 1540, y + 76], 12, C['amber_bg'], C['amber_bd'], 2)
    txt(d, 86, y + 41, '周内锁定：批处理结论周内不翻转，下周一按最新策略参数重算；人工补录 / 导入的商品即时判定入池，标签随下一批次重算。', 19, '#92400e', True, 'lm')
    save(im, 'fig_flow.png')

# ============ 图2 商品挽单判定链路 ============
def fig_judge():
    im, d = canvas(1600, 640, '商品挽单判定链路（商品池 / 补录 / 导入共用同一引擎）', '前三项全部通过才判挽单 · 毛利率只定档')
    gates = [
        ('大数据前置', '在售 · 有平台映射\n非黑名单 · 基准可用\n发货件数 ≥ 100', C['blue'], C['blue_bg'], C['blue_bd']),
        ('商品中类', '包含列表（空=不限）\n排除列表优先', C['primary'], C['indigo_bg'], C['indigo_bd']),
        ('销售件数', '发货口径落在区间\n如 200 ~ 5000 件', C['primary'], C['indigo_bg'], C['indigo_bd']),
        ('退货率倍数', '剔挽退货率 ÷ 同品类基准\n如 1.00× ~ 1.50×', C['primary'], C['indigo_bg'], C['indigo_bd']),
        ('毛利率定档', '落入低 / 中 / 高档区间\n只定档，不定是否挽单', C['amber'], C['amber_bg'], C['amber_bd']),
    ]
    x, y, w, h, gap = 50, 130, 230, 170, 36
    for i, (t, s, fg, bg, bd) in enumerate(gates):
        rr(d, [x, y, x + w, y + h], 14, bg, bd, 2)
        txt(d, x + w / 2, y + 30, t, 23, C['ink'], True, 'mm')
        for j, ln in enumerate(s.split('\n')):
            txt(d, x + w / 2, y + 70 + j * 30, ln, 16, C['sub'], False, 'mm')
        if i < 4:
            arrow(d, x + w + 4, y + h / 2, x + w + gap - 6, y + h / 2, C['primary'], 3)
            arrow(d, x + w / 2, y + h + 4, x + w / 2, y + h + 66, C['red'], 2, 8)
            chip(d, x + w / 2 - 66, y + h + 70, '未通过 → 不挽', C['red'], C['red_bg'], C['red_bd'], 16, 10, 32)
        x += w + gap
    # 结论
    rr(d, [x, y, x + 200, y + h], 14, C['green_bg'], C['green_bd'], 2)
    txt(d, x + 100, y + 46, '判为挽单', 26, C['green'], True, 'mm')
    txt(d, x + 100, y + 92, '归入低 / 中 / 高档', 18, C['sub'], False, 'mm')
    txt(d, x + 100, y + 124, '产出退款比例与上限', 16, C['muted'], False, 'mm')
    arrow(d, x - gap + 4, y + h / 2, x - 6, y + h / 2, C['green'], 3)
    rr(d, [50, 480, 1550, 560], 12, C['white'], C['border'], 2)
    txt(d, 76, 500, '区间均为左闭右开，上限留空表示无上限；未通过项之后的维度不再参与判定。', 19, C['sub'])
    txt(d, 76, 532, '不挽原因逐款可追溯：商品池「判据」抽屉按 维度 / 策略参数 / 商品实测 / 校验结果 四列复现判定过程。', 19, C['sub'])
    save(im, 'fig_judge.png')

# ============ 图3 挽单商品池页面示意 ============
def fig_pool():
    im, d = canvas(1600, 1000, '页面示意 · 挽单商品池（wd-sku-label.html）', '布局示意图，非真实截图')
    rr(d, [40, 100, 1560, 178], 10, C['white'], C['border'], 2)
    d.rectangle([40, 100, 46, 178], fill=C['primary'])
    txt(d, 66, 124, '数据周期 2026W44 ｜ 下次更新 2026-11-02 02:00（下周一凌晨）', 19, C['sub'], False, 'lm')
    txt(d, 66, 152, '判定与挽单以「店铺 × 款」为粒度：同款下各平台商品（色码）共享同一结论与分档。', 14, C['muted'], False, 'lm')
    btn(d, 1210, 119, '商品判定策略'); btn(d, 1380, 119, '手动补跑本周')
    kpis = [('挽单商品', '742', '本表 8 款', C['primary'], True), ('不挽商品', '544', '本表 8 款', C['muted'], False),
            ('本周转入', '96', '不挽 → 挽单', C['green'], False), ('本周转出', '132', '挽单 → 不挽', C['amber'], False)]
    x = 40
    for name, val, sub, color, hero in kpis:
        w = 368
        rr(d, [x, 184, x + w, 296], 12, color if hero else C['white'], None if hero else C['border'], 2)
        fg = C['white'] if hero else C['ink']
        txt(d, x + 22, 206, name, 19, C['white'] if hero else C['sub'], True)
        txt(d, x + 22, 236, val, 36, fg, True)
        txt(d, x + 130, 258, '款', 17, C['white'] if hero else C['muted'])
        txt(d, x + 22, 272, sub, 15, C['white'] if hero else C['muted'])
        x += w + 16
    btn(d, 40, 316, '＋ 新增商品', True); btn(d, 190, 316, '导入商品'); btn(d, 322, 316, '导出商品池')
    xx = 480
    for s in ['快捷：', '本周转挽单', '本周转不挽', '高退货率≥15%', '挽单且毛利率<50%', '人工补录']:
        if s == '快捷：':
            txt(d, xx, 336, s, 17, C['muted'], False, 'lm'); xx += 60
        else:
            xx += chip(d, xx, 319, s, C['sub'], C['white'], C['border'], 16, 12, 34) + 10
    rr(d, [1240, 316, 1560, 356], 8, C['white'], C['border'], 2)
    d.rectangle([1240, 316, 1400, 356], fill=C['primary'])
    txt(d, 1320, 336, '只看挽单商品', 17, C['white'], True, 'mm')
    txt(d, 1480, 336, '全部商品（含不挽）', 17, C['sub'], False, 'mm')
    heads = ['序号', '款号', '店铺', '品牌', '中类', '商品状态', '销售件数', '退货件数', '退货率', '毛利率', '是否挽单', '分档', '判定策略', '本周动态', '操作']
    widths = [52, 130, 128, 62, 86, 76, 82, 82, 78, 72, 88, 72, 130, 82, 100]
    rows = [heads,
        ['1', ('SN-26A-1001', C['primary'], True), 'DY-S001\n森马旗舰店', '森马', '针织上衣', '在售', '3,820', '471', ('12.46%', C['red'], True), '68.4%', ('挽单', C['green'], True, C['green_bg']), ('高档', C['green'], True), ('PD20260818001', C['primary'], False), '维持', ('判据', C['primary'], False)],
        ['2', ('SN-26A-1002', C['primary'], True), 'DY-S001\n森马旗舰店', '森马', '牛仔下装', '在售', '2,410', '357', '11.80%', '58.2%', ('挽单', C['green'], True, C['green_bg']), ('中档', C['blue'], True), ('PD20260818001', C['primary'], False), '维持', ('判据', C['primary'], False)],
        ['3', ('SN-26B-2001', C['faint'], True), 'DY-S002\n巴拉旗舰店', '巴拉', '针织上衣', '在售', '1,180', '315', ('16.60%', C['red'], True), '55.0%', ('不挽', C['muted'], False, C['slate_bg']), '', '', '维持', ('判据', C['primary'], False)],
        ['4', ('SN-26A-9001\n补录', C['orange'], True), 'DY-S001\n森马旗舰店', '森马', '针织上衣', '在售', '2,600', '330', '12.69%', '66.5%', ('挽单', C['green'], True, C['green_bg']), ('高档', C['green'], True), ('PD20260818001', C['primary'], False), ('新进池', C['green'], True), ('判据 删除', C['primary'], False)]]
    # 款号列带补录标记：第4行双行展示
    y = table(d, 40, 380, widths, rows, 56, size=15)
    txt(d, 40, y + 26, '第 1–4 条，共 16 条　第 1/2 页', 17, C['sub'])
    txt(d, 1560, y + 26, '每页 10 条 ｜ 页码 1 2 › ｜ 跳至 _ 确定', 17, C['muted'], False, 'rm')
    rr(d, [40, y + 60, 1560, y + 146], 10, C['indigo_bg'], C['indigo_bd'], 2)
    txt(d, 66, y + 84, '行内「判据」打开右侧抽屉：判定结论（挽单/不挽 + 档位退款参数）→ 店铺规则四维校验表 → 未参与判定原因；', 18, '#3f4a9e')
    txt(d, 66, y + 114, '补录行带橙色「补录」标记，可删除（提示条内可撤销）；抽屉底部支持 人工改标不挽（黑名单）/ 强制改标挽单（白名单）/ 复制判据。', 18, '#3f4a9e')
    save(im, 'fig_pool.png')

# ============ 图4 导入商品弹窗示意 ============
def fig_import():
    im, d = canvas(1500, 1030, '页面示意 · 导入商品弹窗（批量入池）', '布局示意图，非真实截图')
    rr(d, [40, 100, 1460, 990], 16, C['white'], C['border'], 2)
    d.rectangle([40, 100, 1460, 180], fill=C['primary'])
    txt(d, 70, 128, '导入商品入池', 25, C['white'], True)
    txt(d, 70, 156, '上传 CSV 或粘贴表格数据，逐行校验后按各店铺商品判定策略预算「是否挽单」与档位，确认后批量入池', 16, '#dfe3ff')
    txt(d, 1430, 140, '×', 26, C['white'], True, 'mm')
    # 左：上传区
    rr(d, [70, 210, 480, 430], 12, '#fafbff', C['indigo_bd'], 2)
    for i in range(0, 410, 18):
        d.line([70 + i, 210, 70 + i + 8, 210], fill=C['primary'], width=2)
        d.line([70 + i, 430, 70 + i + 8, 430], fill=C['primary'], width=2)
    txt(d, 275, 268, '↑', 40, C['primary'], True, 'mm')
    txt(d, 275, 316, '点击选择或拖入 CSV 文件', 21, C['ink'], True, 'mm')
    txt(d, 275, 352, '支持 .csv / .txt，首行可为表头', 16, C['muted'], False, 'mm')
    txt(d, 275, 382, '也可以直接在右侧粘贴表格数据', 16, C['muted'], False, 'mm')
    txt(d, 70, 452, '首次使用建议先下载模板填写', 17, C['sub'])
    txt(d, 480, 452, '下载导入模板', 17, C['primary'], True, 'ra')
    txt(d, 70, 486, '列顺序（无表头时按此解析）：款号*、店铺*、品牌*、', 15, C['muted'])
    txt(d, 70, 512, '中类*、商品状态*、销售件数*、退货件数*、毛利率(%)*、', 15, C['muted'])
    txt(d, 70, 538, '实付P50(元)、平台映射(是/否)、备注；店铺可填编码或名称。', 15, C['muted'])
    # 右：粘贴区
    txt(d, 520, 210, '粘贴数据（支持从 Excel 复制，Tab 分隔；输入即解析）', 17, C['sub'], True)
    rr(d, [520, 240, 1430, 430], 10, C['white'], C['border'], 2)
    lines = ['款号,店铺,品牌,中类,商品状态,销售件数,退货件数,毛利率(%),实付P50(元),平台映射,备注',
             'SN-26A-9001,DY-S001,森马,针织上衣,在售,2600,330,66.5,268,是,直播专供款',
             'SN-26B-9002,巴拉旗舰店,巴拉,连衣裙,在售,1800,240,58.2,143,是,',
             'SN-26A-9001,DY-S001,森马,针织上衣,在售,2600,330,66.5,268,是,文件内重复',
             'SN-26X-9004,火星店,森马,针织上衣,在售,2600,330,66.5,268,是,店铺不存在']
    for i, ln in enumerate(lines):
        txt(d, 540, 262 + i * 32, ln, 15, C['sub'] if i else C['muted'])
    # 汇总徽章
    xx = 70
    for s, fg, bg, bd in [('解析 6 行', C['muted'], C['slate_bg'], C['border']), ('可导入 2', C['green'], C['green_bg'], C['green_bd']),
                          ('其中挽单 2 · 不挽 0', C['sub'], C['white'], C['border']), ('重复跳过 2', C['orange'], C['orange_bg'], C['orange_bd']),
                          ('校验失败 2', C['red'], C['red_bg'], C['red_bd'])]:
        xx += chip(d, xx, 580, s, fg, bg, bd, 18, 14, 40) + 14
    heads = ['行号', '款号', '店铺', '校验结果', '判定预览', '说明']
    widths = [60, 180, 200, 120, 220, 590]
    rows = [heads,
        ['1', ('SN-26A-9001', C['ink'], True), 'DY-S001 森马旗舰店', ('可导入', C['green'], True, C['green_bg']), ('挽单 · 高档', C['green'], True), '退款 12%，最高 ¥30；预估单笔退款 ¥25.60'],
        ['2', ('SN-26B-9002', C['ink'], True), 'DY-S002 巴拉旗舰店', ('可导入', C['green'], True, C['green_bg']), ('挽单 · 中档', C['green'], True), '退款 8%，最高 ¥15；预估单笔退款 ¥11.44'],
        ['3', ('SN-26A-9001', C['ink'], True), 'DY-S001 森马旗舰店', ('重复跳过', C['orange'], True, C['orange_bg']), '', '与文件内第 1 行重复，跳过'],
        ['5', ('SN-26X-9004', C['ink'], True), '火星店', ('校验失败', C['red'], True, C['red_bg']), '', ('店铺「火星店」不存在', '#b45309', False)]]
    y = table(d, 70, 640, widths, rows, 50, size=16)
    txt(d, 70, y + 14, '判定预览与单条补录使用同一套规则引擎；重复与校验失败行自动跳过，不影响其余行导入。单次最多 500 行。', 16, C['muted'])
    d.line([40, 930, 1460, 930], fill=C['border'], width=2)
    txt(d, 70, 962, '导入的商品按「人工补录」管理，可在列表逐条删除', 17, C['muted'], False, 'lm')
    btn(d, 1150, 942, '取消'); btn(d, 1260, 942, '确认导入（2 行）', True, 170)
    save(im, 'fig_import.png')

# ============ 图5 挽单方案列表示意 ============
def fig_plans():
    im, d = canvas(1600, 950, '页面示意 · 挽单方案列表（wd-strategy.html）', '布局示意图，非真实截图')
    txt(d, 40, 108, '查询区：方案编号 / 方案名称 / 品牌 / 店铺 / 分档 / 挽回类型 / 状态 / 同步平台状态 / 更新时间　[查询] [重置]', 18, C['sub'])
    btn(d, 40, 150, '＋ 新增', True); btn(d, 150, 150, '按商品池重新生成')
    txt(d, 360, 170, '方案按挽单商品池「店铺 × 分档」自动生成，也可手工新建草稿；恢复演示数据', 16, C['muted'], False, 'lm')
    rr(d, [1240, 150, 1560, 190], 8, C['white'], C['border'], 2)
    d.rectangle([1240, 150, 1380, 190], fill=C['primary'])
    txt(d, 1310, 170, '列表视图', 17, C['white'], True, 'mm')
    txt(d, 1470, 170, '店铺×分档矩阵', 17, C['sub'], False, 'mm')
    heads = ['序号', '方案编号', '店铺编码', '店铺名称', '分档', '方案名称', '商品范围', '最大挽留比例', '状态', '同步平台状态', '更新时间', '操作']
    widths = [50, 138, 96, 118, 76, 250, 150, 230, 76, 118, 128, 90]
    def plan_row(i, pid, shop, shopname, tier, tiercolor, name, ratio, status, sync, synctone, updated):
        return [str(i), (pid, C['primary'], True), (shop, C['primary'], False), shopname,
                (tier, tiercolor, True, {'高档': C['green_bg'], '中档': C['blue_bg'], '低档': C['slate_bg'], '': None}[tier]),
                (name, C['ink'], True), '添加商品支持方案\n2 个平台商品\n1 条物理方案', ratio,
                (status, C['green'] if status == '启用' else C['muted'], True, C['green_bg'] if status == '启用' else C['slate_bg']),
                (sync, synctone[0], True, synctone[1]), updated, ('查看 | 编辑', C['primary'], False)]
    rows = [heads,
        plan_row(1, 'WD20261026001', 'DY-S001', '森马旗舰店', '高档', C['green'], '森马旗舰店 高档挽单方案', '全部订单金额：12%\n固定比例，最高 ¥30', '启用', '同步成功', (C['green'], C['green_bg']), '2026-10-26 04:12'),
        plan_row(2, 'WD20261026002', 'DY-S001', '森马旗舰店', '中档', C['blue'], '森马旗舰店 中档挽单方案', '全部订单金额：8%\n固定比例，最高 ¥15', '启用', '同步成功', (C['green'], C['green_bg']), '2026-10-26 04:12'),
        plan_row(5, 'WD20261026005', 'DY-S003', '马卡乐旗舰店', '中档', C['blue'], '马卡乐旗舰店 中档挽单方案', '全部订单金额：8%\n固定比例，最高 ¥15', '启用', '同步失败', (C['red'], C['red_bg']), '2026-10-28 10:00'),
        plan_row(7, 'WD20261026007', 'DY-S004', '森马奥莱店', '中档', C['blue'], '森马奥莱店 中档挽单方案', '全部订单金额：8%\n固定比例，最高 ¥8', '启用', '待同步', (C['amber'], C['amber_bg']), '2026-10-26 04:12'),
        ['9', ('WD20261020001', C['primary'], True), ('DY-S001', C['primary'], False), '森马旗舰店', '', ('森马全店统一挽回金额方案', C['ink'], True), '添加商品不支持方案\n512 款\n6 条物理方案', '存量分档比例（只读）', ('禁用', C['muted'], True, C['slate_bg']), ('同步成功', C['green'], True, C['green_bg']), '2026-10-26 10:30', ('查看 | 编辑', C['primary'], False)]]
    y = table(d, 40, 220, widths, rows, 74, size=14)
    txt(d, 40, y + 24, '共 9 条（8 个自动生成方案 + 1 个存量导入方案）', 17, C['sub'])
    rr(d, [40, y + 60, 1560, y + 190], 12, C['indigo_bg'], C['indigo_bd'], 2)
    txt(d, 66, y + 82, '分档列：高档绿 / 中档蓝 / 低档灰徽章，存量与手工方案留空；支持分档筛选。', 18, '#3f4a9e')
    txt(d, 66, y + 112, '「店铺×分档矩阵」视图：行 = 4 个店铺，列 = 高 / 中 / 低档 + 存量，用于核对同一商品是否被多条方案重复覆盖。', 18, '#3f4a9e')
    txt(d, 66, y + 142, '「按商品池重新生成」：策略参数或商品池变化后按当前「店铺 × 分档」重算，自动生成方案上的手工修改被覆盖，手工新建方案保留。', 18, '#3f4a9e')
    save(im, 'fig_plans.png')

# ============ 图6 挽单方案详情示意 ============
def fig_plan_detail():
    im, d = canvas(1500, 1150, '页面示意 · 挽单方案详情（wd-strategy-detail.html）', '布局示意图，非真实截图')
    txt(d, 40, 112, '← 返回挽单方案', 19, C['primary'], True)
    rr(d, [1080, 96, 1280, 140], 20, C['green_bg'], C['green_bd'], 2)
    d.ellipse([1094, 108, 1120, 134], fill=C['green'])
    txt(d, 1136, 118, '启用 · 方案状态', 17, C['green'], True, 'lm')
    btn(d, 1310, 98, '编辑', True, 120)
    def sec(y, title, h):
        rr(d, [40, y, 1460, y + h], 12, C['white'], C['border'], 2)
        txt(d, 66, y + 22, title, 21, C['ink'], True)
        d.line([66, y + 56, 1434, y + 56], fill=C['border'], width=1)
        return y + 70
    y = sec(170, '基本信息', 240)
    kv = [('系统方案编码', 'WD20261026001'), ('店铺编码', 'DY-S001'), ('店铺名称', '森马旗舰店'),
          ('平台方案ID', '74128930198'), ('同步平台状态', '同步成功（回读一致，平台真实生效）'), ('同步失败原因', ''),
          ('创建人', '系统自动生成'), ('创建时间', '2026-10-26 04:12'), ('更新人', '系统自动生成'), ('更新时间', '2026-10-26 04:12')]
    for i, (k, v) in enumerate(kv):
        cx = 66 + (i % 2) * 700
        cy = y + 8 + (i // 2) * 34
        txt(d, cx, cy, k, 16, C['muted'])
        txt(d, cx + 150, cy, v, 16, C['ink'], True)
    y = sec(430, '挽留条件', 330)
    conds = [('挽留类型', '自定义挽单（智能挽单本期锁定）'), ('挽单场景', '消费者申请售后后（飞鸽进线本期锁定）'),
             ('生效售后类型', '退货退款'), ('生效售后原因', '无理由原因、其他原因'),
             ('商品范围', '添加商品支持方案：DY_3829100005、DY_3829100016（该分档挽单商品）'),
             ('人群范围 / 订单金额范围', '不限制 / 不限制（全部订单金额按统一规则执行）')]
    for i, (k, v) in enumerate(conds):
        cy = y + 6 + i * 42
        txt(d, 66, cy, k, 17, C['muted'])
        txt(d, 320, cy, v, 17, C['ink'])
    y = sec(780, '挽留方案', 270)
    txt(d, 66, y + 6, '协商部分退款规则', 17, C['muted'])
    xx = 320
    xx += chip(d, xx, y, '按订单实付金额百分比退款 （锁定）', C['faint'], C['slate_bg'], C['border'], 16, 12, 36) + 10
    xx += chip(d, xx, y, '按固定比例退款', C['white'], C['primary'], None, 16, 12, 36) + 10
    chip(d, xx, y, '按固定金额退款', C['sub'], C['white'], C['border'], 16, 12, 36)
    rr(d, [320, y + 52, 1434, y + 104], 9, '#fafbff', C['border'], 2)
    txt(d, 340, y + 78, '退款订单实付金额的 [ 12 ] % ，且最高不超过 [ 30 ] 元', 19, C['ink'], True, 'lm')
    txt(d, 320, y + 118, '选填内容为空则表示不设置金额上限；若计算后的退款金额小于 1 元，则按 1 元挽留。', 15, C['muted'])
    txt(d, 66, y + 156, '每日挽留成本上限', 17, C['muted'])
    chip(d, 320, y + 150, '不限制', C['white'], C['primary'], None, 16, 12, 36)
    chip(d, 430, y + 150, '挽留成本不超过', C['sub'], C['white'], C['border'], 16, 12, 36)
    txt(d, 620, y + 168, '（limit 时显示：成本不超过 [金额] 元 + 建议额度一键填入 + 说明气泡）', 15, C['muted'], False, 'lm')
    rr(d, [40, 1064, 1460, 1134], 12, C['white'], C['border'], 2)
    txt(d, 66, 1086, '操作日志：创建方案（按挽单商品池「森马旗舰店 × 高档」生成，退款参数取自策略 PD20260818001 分档规则）→ 同步平台 → 回读校验通过', 16, C['sub'])
    save(im, 'fig_plan_detail.png')

# ============ 图7 策略分档规则与执行记录示意 ============
def fig_strategy():
    im, d = canvas(1600, 980, '页面示意 · 商品判定策略：分档规则 与 执行记录抽屉', '布局示意图，非真实截图')
    # 左：分档规则
    rr(d, [40, 110, 800, 640], 12, C['white'], C['border'], 2)
    txt(d, 66, 136, '分档规则（策略明细页 · 只定档，不定是否挽单）', 21, C['ink'], True)
    heads = ['档位', '毛利率区间（%）', '退款比例（%）', '最高退款金额（元）']
    widths = [110, 220, 180, 220]
    rows = [heads,
        [('低档', C['muted'], True), '45 ~ 54', '5', '5'],
        [('中档', C['blue'], True), '54 ~ 63', '8', '15'],
        [('高档', C['green'], True), '63 ~ 无上限', '12', '30']]
    y = table(d, 66, 180, widths, rows, 52, size=17)
    txt(d, 66, y + 20, '保存自检：下界 > 0；相邻档必须无缝；最高档上限必须留空；', 16, C['sub'])
    txt(d, 66, y + 50, '退款比例 0~100；最高退款金额 > 0；低档两项参数不得高于高档。', 16, C['sub'])
    rr(d, [66, y + 86, 774, y + 166], 9, C['indigo_bg'], C['indigo_bd'], 2)
    txt(d, 86, y + 106, '按当前参数实算：该店商品 5 行，候选 5 行，挽单 3 行', 16, '#3f4a9e', True)
    txt(d, 86, y + 136, '（低档 1 / 中档 1 / 高档 1），逐行明细见挽单商品池。', 16, '#3f4a9e')
    txt(d, 66, y + 196, '退款口径：按订单实付金额 refundRate%，单笔最高 maxRefund 元；', 16, C['muted'])
    txt(d, 66, y + 226, '该口径直接作为挽单方案的「协商部分退款规则」。', 16, C['muted'])
    # 右：执行记录抽屉
    rr(d, [840, 110, 1560, 930], 12, C['white'], C['border'], 2)
    d.rectangle([840, 110, 1560, 176], fill=C['indigo_bg'])
    txt(d, 866, 132, '执行记录 · 2026W44（本批次）', 21, C['ink'], True)
    txt(d, 866, 156, 'PD20260818001 森马旗舰店挽单判定策略 · DY-S001', 15, C['muted'])
    kpis = [('覆盖款数', '620'), ('进池款数', '3'), ('未进池', '2'), ('生成方案', '3'), ('同步成功', '2'), ('同步失败', '0')]
    xx = 866
    for k, v in kpis:
        rr(d, [xx, 196, xx + 106, 272], 9, '#fafbff', C['border'], 1)
        txt(d, xx + 53, 216, k, 14, C['muted'], False, 'mm')
        txt(d, xx + 53, 248, v, 24, C['ink'], True, 'mm')
        xx += 114
    txt(d, 866, 300, '影响面对比（本批 vs 上一批）：进池 +1 / 移出 0 / 档位迁移 0', 16, C['sub'])
    txt(d, 866, 340, '生成并同步的方案', 19, C['ink'], True)
    heads2 = ['方案编号', '分档', '退款规则', '覆盖款数', '同步状态']
    w2 = [160, 80, 190, 90, 150]
    rows2 = [heads2,
        [('WD20261026001', C['primary'], True), '高档', '退款 12%，最高 ¥30', '1', ('同步成功', C['green'], True, C['green_bg'])],
        [('WD20261026002', C['primary'], True), '中档', '退款 8%，最高 ¥15', '1', ('同步成功', C['green'], True, C['green_bg'])],
        [('WD20261026003', C['primary'], True), '低档', '退款 5%，最高 ¥5', '1', ('同步中', C['blue'], True, C['blue_bg'])]]
    y2 = table(d, 866, 372, w2, rows2, 48, size=15)
    txt(d, 866, y2 + 24, '下发与重试', 19, C['ink'], True)
    txt(d, 866, y2 + 58, '同一方案编号在抖店原地更新，不会重复新建。', 16, C['sub'])
    txt(d, 866, y2 + 88, '仅本批次可重试 / 回滚；回滚后上一批生效，不改策略参数。', 16, C['sub'])
    rr(d, [866, y2 + 122, 1534, y2 + 198], 9, C['amber_bg'], C['amber_bd'], 2)
    txt(d, 886, y2 + 142, '失败场景：回读不一致 → 同步失败，冻结下周发布；', 16, '#92400e')
    txt(d, 886, y2 + 170, '「重试」重新下发失败方案，成功后状态翻转并累计重试次数。', 16, '#92400e')
    btn(d, 1180, y2 + 214, '回滚本批次'); btn(d, 1330, y2 + 214, '重试全部失败', True, 200)
    save(im, 'fig_strategy.png')

if __name__ == '__main__':
    fig_flow(); fig_judge(); fig_pool(); fig_import(); fig_plans(); fig_plan_detail(); fig_strategy()
    print('ALL FIGURES DONE')