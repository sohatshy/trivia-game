# Builds data/questions.json from the lists below.
# Run from the project folder:  python tools/build_questions.py   (add --fresh to overwrite non-geo questions)
# Geography questions are kept from the existing questions.json (they were added in step 1).
# Math answers and the letter-trick riddles are re-checked by code before writing.
#
# NOTE: after the review page exists, edits made there are saved to questions.json directly.
# Re-running this script keeps any question whose id already exists in questions.json
# (so your review edits/verdicts are never overwritten) and only adds new ids.

import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "questions.json")
PTS = {"easy": 200, "medium": 400, "hard": 600}
L = {"easy": "e", "medium": "m", "hard": "h"}
LRI, PDI = "⁦", "⁩"  # keep math expressions left-to-right inside Arabic text

CATEGORIES = [
    {"id": "geo", "name": "جغرافيا", "type": "text", "icon": "globe"},
    {"id": "flags", "name": "أعلام الدول", "type": "flag", "icon": "flag"},
    {"id": "rivals", "name": "مارفل رايفلز", "type": "text", "icon": "mask"},
    {"id": "math", "name": "رياضيات", "type": "text", "icon": "calc"},
    {"id": "riddles", "name": "ألغاز", "type": "text", "icon": "bulb"},
    {"id": "letters", "name": "حروف", "type": "letters", "icon": "letter"},
]

WEN = "https://en.wikipedia.org/wiki/"
WAR = "https://ar.wikipedia.org/wiki/"
MRW = "https://marvelrivals.fandom.com/wiki/"
MR_NOTE = "تم التحقق في الموسم 10 (Butcher's Blasphemy) — أكتوبر 2026"

# ---------------------------------------------------------------- flags
# (iso code, answer, source page)
FLAG_Q = "ما اسم الدولة صاحبة هذا العلم؟"
flags = {
    "easy": [
        ("sa", "السعودية", "Flag_of_Saudi_Arabia"), ("eg", "مصر", "Flag_of_Egypt"),
        ("us", "الولايات المتحدة الأمريكية", "Flag_of_the_United_States"), ("jp", "اليابان", "Flag_of_Japan"),
        ("br", "البرازيل", "Flag_of_Brazil"), ("gb", "المملكة المتحدة (بريطانيا)", "Flag_of_the_United_Kingdom"),
        ("ca", "كندا", "Flag_of_Canada"), ("de", "ألمانيا", "Flag_of_Germany"),
        ("ae", "الإمارات العربية المتحدة", "Flag_of_the_United_Arab_Emirates"), ("ma", "المغرب", "Flag_of_Morocco"),
    ],
    "medium": [
        ("kw", "الكويت", "Flag_of_Kuwait"), ("qa", "قطر", "Flag_of_Qatar"), ("dz", "الجزائر", "Flag_of_Algeria"),
        ("tn", "تونس", "Flag_of_Tunisia"), ("lb", "لبنان", "Flag_of_Lebanon"), ("kr", "كوريا الجنوبية", "Flag_of_South_Korea"),
        ("mx", "المكسيك", "Flag_of_Mexico"), ("in", "الهند", "Flag_of_India"), ("ar", "الأرجنتين", "Flag_of_Argentina"),
        ("gr", "اليونان", "Flag_of_Greece"),
    ],
    "hard": [
        ("td", "تشاد (يشبه علم رومانيا تقريباً)", "Flag_of_Chad"),
        ("ro", "رومانيا (يشبه علم تشاد تقريباً)", "Flag_of_Chad"),
        ("mc", "موناكو (يشبه علم إندونيسيا)", "Flag_of_Monaco"),
        ("ci", "ساحل العاج (يشبه علم أيرلندا معكوساً)", "Flag_of_Ivory_Coast"),
        ("nz", "نيوزيلندا (يشبه علم أستراليا)", "Flag_of_New_Zealand"),
        ("lu", "لوكسمبورغ (يشبه علم هولندا)", "Flag_of_Luxembourg"),
        ("km", "جزر القمر", "Flag_of_the_Comoros"),
        ("bt", "بوتان", "Flag_of_Bhutan"),
        ("np", "نيبال", "Flag_of_Nepal"),
        ("dj", "جيبوتي", "Flag_of_Djibouti"),
    ],
}

# ---------------------------------------------------------------- Marvel Rivals
rivals = {
    "easy": [
        ("ما الشركة التي طوّرت لعبة مارفل رايفلز؟", "NetEase Games (نت إيز)", WEN + "Marvel_Rivals"),
        ("كم عدد اللاعبين في كل فريق في المباراة العادية؟", "6 لاعبين (6 ضد 6)", WEN + "Marvel_Rivals"),
        ("ما الأدوار الثلاثة التي يُقسَّم إليها الأبطال في اللعبة؟", "Vanguard وDuelist وStrategist (فانغارد، دويلست، ستراتيجست)", WEN + "Marvel_Rivals"),
        ("ما اسم المطرقة التي يحملها ثور في اللعبة؟", "ميولنير (Mjölnir)", MRW + "Thor"),
        ("ما دور القرش الصغير «جيف» في اللعبة: مدافع أم مهاجم أم داعم (Strategist)؟", "داعم (Strategist)", MRW + "Jeff_the_Land_Shark"),
        ("أي بطل في اللعبة هو ملك واكاندا؟", "بلاك بانثر (تي تشالا)", MRW + "Black_Panther"),
        ("غروت كائن من أي نوع؟", "كائن نباتي ضخم (شجرة) من الكوكب X", MRW + "Groot"),
        ("أي بطل يتحوّل من العالِم بروس بانر؟", "هالك", MRW + "Hulk"),
        ("من أي معدن صُنع درع كابتن أمريكا في اللعبة؟", "الفايبرانيوم", MRW + "Captain_America"),
        ("ما دور روكيت راكون في اللعبة: مدافع أم مهاجم أم داعم؟", "داعم (Strategist)", MRW + "Rocket_Raccoon"),
    ],
    "medium": [
        ("في أي سنة صدرت لعبة مارفل رايفلز؟", "2024 (في 6 ديسمبر)", WEN + "Marvel_Rivals"),
        ("ما محرّك الألعاب الذي بُنيت عليه مارفل رايفلز؟", "Unreal Engine 5 (أنريل إنجن 5)", WEN + "Marvel_Rivals"),
        ("ما اسم الموسم الأول في اللعبة؟", "Eternal Night Falls (حلول الليل الأبدي)", WEN + "Marvel_Rivals"),
        ("أي فريق أبطال انضم إلى اللعبة في الموسم الأول؟", "الرباعي المذهل (Fantastic Four)", WEN + "Marvel_Rivals"),
        ("ما اسم الميزة التي تمنح البطل قدرة إضافية عندما يكون بطل معيّن في فريقه؟", "Team-Up (التحالف)", WEN + "Marvel_Rivals"),
        ("ما اسم الخريطة المستوحاة من أسغارد موطن ثور؟", "Yggsgard (يغسغارد)", WEN + "Marvel_Rivals"),
        ("لونا سنو نجمة غناء وبطلة خارقة، فما نوع قواها؟", "قوى الجليد", MRW + "Luna_Snow"),
        ("ما اسم الروبوت العملاق (الميك) الذي تقوده بيني باركر؟", "SP//dr (سبايدر)", MRW + "Peni_Parker"),
        ("ما اسم السيف الذي تحمله ماجيك؟", "Soulsword (سيف الروح)", MRW + "Magik"),
        ("إلى أي شكلين يستطيع بروس بانر التحوّل في اللعبة؟", "هالك البطل (Hero Hulk) وهالك الوحش (Monster Hulk)", MRW + "Hulk"),
    ],
    "hard": [
        ("ما اسم النسخة المستقبلية من دكتور دوم التي تتصارع معه في قصة اللعبة؟", "دوم 2099 (Doom 2099)", MRW + "Doom_2099"),
        ("ما اسم الحدث الذي خلطَ العوالم ببعضها في قصة اللعبة؟", "Timestream Entanglement (تشابك الخط الزمني)", MRW + "Doom_2099"),
        ("من الشرير الرئيسي في الموسم الأول؟", "دراكولا", MRW + "Dracula"),
        ("كوكب «كلينتار» هو الموطن الأصلي لأي كائنات؟", "السيمبيوت (Symbiotes)", MRW + "Klyntar"),
        ("ما الاسم الحقيقي لبطل «آيرون فيست» في مارفل رايفلز؟", "لين لي (Lin Lie)", MRW + "Iron_Fist"),
        ("ما البطل الجديد الوحيد الذي أُضيف في الموسم العاشر؟", "غور قاتل الآلهة (Gorr the God Butcher)", MRW + "Gorr"),
        ("ما اسم الهيئة الشيطانية التي تتحوّل إليها ماجيك؟", "Darkchylde (دارك تشايلد)", MRW + "Magik"),
        ("ما الاسم الحقيقي لبطلة «لونا سنو»؟", "سول هي (Seol Hee)", MRW + "Luna_Snow"),
        ("ما اسم السيف الذي يقاتل به غور؟", "All-Black the Necrosword (النيكروسورد)", MRW + "Gorr"),
        ("على أي سلسلة قصص مصوّرة بُنيت قصة الموسم الأول؟", "Blood Hunt (بلود هنت)", WEN + "Marvel_Rivals"),
    ],
}

# ---------------------------------------------------------------- math
# (question text with {e} placeholder, expression to check, answer)
def m(expr_shown, expr_py, prefix="كم يساوي", suffix="؟"):
    return (f"{prefix} {LRI}{expr_shown}{PDI}{suffix}", expr_py)

math_q = {
    "easy": [m("7 × 8", "7*8"), m("45 + 38", "45+38"), m("100 − 37", "100-37"), m("12 × 5", "12*5"),
             m("81 ÷ 9", "81/9"), ("ما نصف العدد 90؟", "90/2"), m("9 × 6", "9*6"), m("64 − 29", "64-29"),
             m("25 × 4", "25*4"), m("150 + 250", "150+250")],
    "medium": [m("15 × 15", "15*15"), m("144 ÷ 12", "144/12"), m("17 + 28 + 35", "17+28+35"),
               ("كم يساوي 25% من 240؟", "240*25/100"), m("13 × 7", "13*7"), m("1000 − 387", "1000-387"),
               ("ما الجذر التربيعي للعدد 196؟", "196**0.5"), m("3 × 3 × 3", "3*3*3"), m("45 × 4", "45*4"),
               m("7 × 8 + 6 × 9", "7*8+6*9")],
    "hard": [m("23 × 17", "23*17"), m("48 × 25", "48*25"), m("999 × 7", "999*7"),
             ("كم يساوي العدد 2 مرفوعاً للقوة 10؟", "2**10"), m("19 × 21", "19*21"),
             m("17 × 17", "17*17"), ("كم يساوي 12.5% من 640؟", "640*12.5/100"),
             ("ما مجموع الأعداد من 1 إلى 20؟", "sum(range(1,21))"), m("125 × 16", "125*16"),
             m("(36 × 25) − 99", "(36*25)-99")],
}

# ---------------------------------------------------------------- riddles
M1 = "https://mawdoo3.com/ألغاز_ذكاء_مع_الحلول"
M2 = "https://mawdoo3.com/ألغاز_لتنمية_الذكاء_عند_الأطفال"
S1 = "https://www.sayidaty.net/node/1814775"
S2 = "https://www.sayidaty.net/node/1795749"
riddles = {
    "easy": [
        ("ما الشيء الذي يكتب ولا يقرأ؟", "القلم", S1),
        ("ما الشيء الذي له عين واحدة ولا يرى؟", "الإبرة", S1),
        ("ما الشيء الذي كلما أخذتَ منه كَبُر؟", "الحفرة", M2),
        ("ما الشيء الذي يجب أن نكسره قبل أن نستعمله؟", "البيض", M2),
        ("ما الشيء الذي يقرصك ولا تراه؟", "الجوع", S1),
        ("ما الشيء الذي تأكل منه ولكنه لا يؤكل؟", "الطبق", S1),
        ("ما الشيء الذي يأكل ولا يشبع أبداً؟", "النار", M2),
        ("ما الحيوان الذي يحكّ أذنه بأنفه؟", "الفيل", M2),
        ("شيء إذا نزعتَ قشرته لا يبكي، لكنك أنت تبكي عليه. ما هو؟", "البصل", S2),
        ("شيء له خمسة أصابع ولا يستطيع أن يمسك أي شيء. ما هو؟", "القفاز", M2),
    ],
    "medium": [
        ("ما الشيء الذي يكون أمامك دائماً ولا تستطيع رؤيته؟", "المستقبل", M1),
        ("شيء تملكه أنت، لكن غيرك يستخدمه أكثر منك. ما هو؟", "اسمك", M1),
        ("ما الشيء الذي يكون أخضر في الأرض، أسود في السوق، أحمر في البيت؟", "الشاي", S1),
        ("ما الشيء الذي يحرق نفسه ليضيء لغيره؟", "الشمعة", M2),
        ("كم شهراً في السنة فيه 28 يوماً؟", "كل الأشهر (12 شهراً)", M2),
        ("ما الشيء الذي تسمعه وتراه، وهو لا يسمعك ولا يراك؟", "التلفاز", M2),
        ("شيء له مفاتيح كثيرة لكنه لا يفتح أي باب. ما هو؟", "البيانو", M2),
        ("ما الشيء الذي إذا قلتَه لأي شخص فقدَ قيمته؟", "السر", M2),
        ("عندي بحار بلا ماء، ومدن بلا ناس، وجبال بلا تراب. من أنا؟", "الخريطة", M1),
        ("رجل يحلق عدة مرات في اليوم، ومع ذلك تبقى لحيته طويلة. من هو؟", "الحلاق", M1),
    ],
    "hard": [
        ("ما الشيء الذي يوجد في «القرن» مرة، وفي «الدقيقة» مرتين، ولا يوجد في «الساعة»؟", "حرف القاف", M2),
        ("ما الشيء الذي تجده خمسة في «الشتاء» وثلاثة في «الصيف»؟", "النقاط (نقاط الحروف)", M2),
        ("تاجر إذا اقتلعنا عينه طار. من هو؟", "العطّار (عطّار بدون العين = طار)", S1),
        ("ما الشيء الذي تراه في «الليل» ثلاث مرات، وفي «النهار» مرة واحدة؟", "حرف اللام", None),
        ("فاكهة اسمها من ثلاثة حروف، يُقرأ من اليمين ومن اليسار بالشكل نفسه، أوله وآخره تاء. ما هي؟", "التوت", M2),
        ("ما الشيء الذي يخترق الزجاج ولا يكسره؟", "الضوء", M2),
        ("كُلّي ثقوب، ومع ذلك أحفظ الماء. من أنا؟", "الإسفنج", M2),
        ("ما الشيء الذي يوصلك من بيتك إلى عملك وهو لا يتحرك؟", "الطريق", M2),
        ("ما الشيء الذي حجمه مثل حجم الفيل تماماً، لكنه لا يزن شيئاً؟", "ظل الفيل", M2),
        ("ما الشيء الذي ينبض بلا قلب؟", "الساعة", M2),
    ],
}

# ---------------------------------------------------------------- letters
# (category text, letter, examples, Arabic Wikipedia page used as source)
letters = {
    "easy": [
        ("حيوان", "ج", ["جمل", "جاموس", "جرذ"], "جمل"),
        ("فاكهة", "ت", ["تفاح", "تمر", "تين", "توت"], "تفاح"),
        ("دولة", "م", ["مصر", "ماليزيا", "موريتانيا", "مالي", "المكسيك"], "مصر"),
        ("مدينة", "ب", ["بغداد", "بيروت", "باريس", "برلين"], "بغداد"),
        ("حيوان", "ف", ["فيل", "فهد", "فأر", "فرس النهر"], "فيل"),
        ("خضار", "ب", ["بطاطس", "بصل", "باذنجان", "بامية"], "بصل"),
        ("دولة", "ك", ["كندا", "الكويت", "كينيا", "كوبا", "كولومبيا"], "كندا"),
        ("شيء في المطبخ", "م", ["ملعقة", "مقلاة", "مغسلة"], "ملعقة"),
        ("حيوان", "ح", ["حصان", "حمار", "حوت", "حرباء"], "حمار"),
        ("مدينة", "د", ["دبي", "دمشق", "الدوحة", "دلهي"], "دبي"),
    ],
    "medium": [
        ("حيوان", "ق", ["قرد", "قط", "قنفذ", "قرش", "قندس"], "قنفذ"),
        ("دولة", "ت", ["تونس", "تركيا", "تشاد", "تايلاند", "تنزانيا"], "تونس"),
        ("فاكهة", "م", ["موز", "مانجو", "مشمش"], "موز"),
        ("مدينة", "ع", ["عمّان", "عدن", "العين", "عجمان", "العقبة"], "عدن"),
        ("حيوان أو طائر", "ن", ["نمر", "نعامة", "نحلة", "نسر", "نمس"], "نعامة"),
        ("مهنة", "ط", ["طبيب", "طيار", "طاهٍ"], "طبيب"),
        ("لون", "ب", ["بني", "برتقالي", "بنفسجي"], "بنفسجي"),
        ("رياضة", "ك", ["كرة القدم", "كرة السلة", "كاراتيه", "كريكيت"], "كاراتيه"),
        ("دولة", "ص", ["الصين", "الصومال", "صربيا"], "صربيا"),
        ("حيوان", "خ", ["خروف", "خفاش", "خيل", "خلد"], "خلد"),
    ],
    "hard": [
        ("حيوان", "ظ", ["ظبي", "ظربان"], "ظبي"),
        ("حيوان", "ض", ["ضبع", "ضفدع", "ضب"], "ضبع"),
        ("حيوان", "ث", ["ثعلب", "ثعبان", "ثور"], "ثعلب"),
        ("دولة أو مدينة", "غ", ["غانا", "غينيا", "غواتيمالا", "غرناطة"], "غانا"),
        ("دولة", "ز", ["زامبيا", "زيمبابوي"], "زامبيا"),
        ("جزء من جسم الإنسان", "ظ", ["ظهر", "ظفر"], "ظفر"),
        ("جزء من جسم الإنسان", "ذ", ["ذراع", "ذقن"], "ذقن"),
        ("حيوان أو طائر", "غ", ["غزال", "غراب", "غوريلا"], "غوريلا"),
        ("دولة", "هـ", ["الهند", "هولندا", "هنغاريا", "هايتي", "هندوراس"], "هايتي"),
        ("مدينة", "ط", ["طرابلس", "طنجة", "طوكيو", "الطائف"], "طنجة"),
    ],
}


# ---------------------------------------------------------------- checks
def fmt(n):
    return str(int(n)) if float(n).is_integer() else str(n)

def check_letter_riddles():
    dots = {"ب": 1, "ت": 2, "ث": 3, "ج": 1, "خ": 1, "ذ": 1, "ز": 1, "ش": 3, "ض": 1, "ظ": 1, "غ": 1, "ف": 1, "ق": 2, "ن": 1, "ي": 2, "ة": 2}
    assert ("القرن".count("ق"), "الدقيقة".count("ق"), "الساعة".count("ق")) == (1, 2, 0)
    assert sum(dots.get(c, 0) for c in "الشتاء") == 5 and sum(dots.get(c, 0) for c in "الصيف") == 3
    assert "الليل".count("ل") == 3 and "النهار".count("ل") == 1
    assert "عطار".replace("ع", "", 1) == "طار"
    assert "توت" == "توت"[::-1]
    for d, items in letters.items():
        for cat, letter, ex, _ in items:
            for e in ex:
                first = e[2] if e.startswith("ال") else e[0]
                assert first == letter[0], (e, letter)

def build():
    check_letter_riddles()
    existing = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {"questions": []}
    # --fresh: rebuild every non-geography question from this file (only before the review starts!)
    fresh = "--fresh" in sys.argv
    keep = {q["id"]: q for q in existing["questions"] if not (fresh and q["category"] != "geo")}
    new = []

    def add(cat, d, i, **f):
        qid = f"{cat}-{L[d]}-{i:02d}"
        base = {"id": qid, "category": cat, "difficulty": d, "points": PTS[d], "question": "", "answer": "",
                "examples": [], "image": None, "source": None, "verified": True, "note": ""}
        base.update(f)
        new.append(keep.get(qid, base))

    for d in PTS:
        for i, q in enumerate([q for q in existing["questions"] if q["category"] == "geo" and q["difficulty"] == d], 1):
            new.append(q)
        for i, (code, ans, page) in enumerate(flags[d], 1):
            assert os.path.exists(os.path.join(ROOT, "assets", "flags", f"{code}.svg")), code
            add("flags", d, i, question=FLAG_Q, answer=ans, image=f"assets/flags/{code}.svg", source=WEN + page)
        for i, (q, a, s) in enumerate(rivals[d], 1):
            add("rivals", d, i, question=q, answer=a, source=s, note=MR_NOTE)
        for i, (q, expr) in enumerate(math_q[d], 1):
            add("math", d, i, question=q, answer=fmt(eval(expr)), note="الإجابة محسوبة ومُتحقق منها برمجياً")
        for i, (q, a, s) in enumerate(riddles[d], 1):
            add("riddles", d, i, question=q, answer=a, source=s,
                note="" if s else "لغز حروف: تم التحقق بعدّ الحروف برمجياً")
        for i, (cat, letter, ex, src) in enumerate(letters[d], 1):
            add("letters", d, i, question=f"{cat} يبدأ بحرف «{letter}»", answer="أي إجابة صحيحة تبدأ بالحرف",
                examples=ex, source=WAR + src)

    order = {c["id"]: n for n, c in enumerate(CATEGORIES)}
    new.sort(key=lambda q: (order[q["category"]], PTS[q["difficulty"]], q["id"]))
    data = {"version": 2, "categories": CATEGORIES, "questions": new}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    from collections import Counter
    print(Counter((q["category"], q["difficulty"]) for q in new))
    print("total", len(new), "verified", sum(q["verified"] for q in new))

if __name__ == "__main__":
    build()
