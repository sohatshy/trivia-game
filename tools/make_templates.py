# Writes the bulk-import templates: templates/template.csv and templates/template.xlsx
#   python tools/make_templates.py
# The .xlsx is built with the standard library only (an .xlsx file is a zip of XML files).
# The 2 example rows are placeholders, not real questions; the importer skips them automatically.
import csv, os, zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "templates")

HEADER = ["category", "difficulty", "question", "answer", "source"]
EXAMPLES = [
    ["جغرافيا", "easy", "اكتب نص السؤال هنا", "اكتب الإجابة هنا", "https://example.com/source"],
    ["حروف", "hard", "اكتب نص السؤال هنا (مثال لفئة الحروف)", "مثال 1 | مثال 2 | مثال 3", ""],
]
HELP = [
    ["العمود", "ماذا تكتب فيه"],
    ["category", "اسم الفئة كما في لوحة التحكم (مثل: جغرافيا) أو رمزها (مثل: geo)."],
    ["difficulty", "easy أو medium أو hard  (أو: سهل / متوسط / صعب، أو 200 / 400 / 600)."],
    ["question", "نص السؤال."],
    ["answer", "الإجابة. لفئة «حروف» اكتب عدة أمثلة وافصل بينها بـ | أو بالفاصلة العربية ،"],
    ["source", "رابط المصدر (اختياري)، يبدأ بـ https://"],
    ["", ""],
    ["ملاحظة", "احذف صفّي المثال قبل الاستيراد (وإن نسيت فستتجاهلهما لوحة التحكم)."],
    ["ملاحظة", "الأسئلة المستوردة تكون «غير مُتحقق منها» و«لم تُراجع» حتى تراجعها في لوحة التحكم."],
]


def write_csv(path):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:  # BOM so Excel reads Arabic correctly
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(EXAMPLES)


def col(i):
    return chr(ord("A") + i)


def sheet_xml(rows, widths, header_style=1, validation=None):
    cols = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, w in enumerate(widths))
    body = []
    for r, row in enumerate(rows, 1):
        cells = []
        for c, value in enumerate(row):
            style = f' s="{header_style}"' if r == 1 else ' s="2"'
            cells.append(f'<c r="{col(c)}{r}" t="inlineStr"{style}><is><t xml:space="preserve">{escape(value)}</t></is></c>')
        body.append(f'<row r="{r}">{"".join(cells)}</row>')
    dv = ""
    if validation:
        ref, items = validation
        dv = (f'<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="{ref}">'
              f'<formula1>"{",".join(items)}"</formula1></dataValidation></dataValidations>')
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            f'<cols>{cols}</cols><sheetData>{"".join(body)}</sheetData>{dv}</worksheet>')


def write_xlsx(path):
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '</Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>',
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="الأسئلة" sheetId="1" r:id="rId1"/><sheet name="تعليمات" sheetId="2" r:id="rId2"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '</Relationships>',
        "xl/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="12"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF2C2170"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>'
        '</styleSheet>',
        "xl/worksheets/sheet1.xml": sheet_xml([HEADER, *EXAMPLES], [16, 12, 60, 34, 36], validation=("B2:B5000", ["easy", "medium", "hard"])),
        "xl/worksheets/sheet2.xml": sheet_xml(HELP, [14, 90]),
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    write_csv(os.path.join(OUT, "template.csv"))
    write_xlsx(os.path.join(OUT, "template.xlsx"))
    print("wrote templates/template.csv and templates/template.xlsx")
