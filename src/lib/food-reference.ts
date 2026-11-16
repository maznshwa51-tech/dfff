// جدول مرجعي ثابت لأكلات شائعة (القيم لكل 100 غ كما تنأكل، من USDA وملصقات المنتجات والوصفات الخليجية الشائعة).
// إذا الأكل موجود هنا، نستخدم هذي الأرقام بالضبط بدل أرقام Gemini، عشان النتيجة ما تتغير من مرة لمرة.
// Gemini بس يحدد الكمية (كم غرام) ويقول أي صنف من الجدول.

export interface RefFood {
  id: string;
  names: string;
  /** وزن الحبة / الحصة المعتادة (للمساعدة في تقدير الكمية) */
  unit: string;
  kcal: [number, number];
  protein: [number, number];
  carbs: [number, number];
  fat: [number, number];
}

export const FOOD_REFERENCE: RefFood[] = [
  { id: "luqaimat", names: "لقيمات luqaimat (with date/sugar syrup)", unit: "1 piece ≈ 18 g", kcal: [330, 360], protein: [4.5, 5.5], carbs: [50, 56], fat: [12, 14] },
  { id: "kitkat", names: "كيكات / كيت كات KitKat", unit: "4-finger bar = 41.5 g, 2-finger = 20.7 g", kcal: [505, 520], protein: [6, 7], carbs: [59, 63], fat: [25, 27] },
  { id: "kinder_bueno", names: "كندر بوينو Kinder Bueno", unit: "1 pack (2 bars) = 43 g", kcal: [565, 575], protein: [8.5, 9.2], carbs: [49, 50], fat: [37, 38] },
  { id: "kinder_chocolate", names: "كندر شوكولاتة Kinder Chocolate", unit: "1 bar = 12.5 g", kcal: [560, 570], protein: [8.5, 9], carbs: [53, 54], fat: [35, 36] },
  { id: "dates", names: "تمر dates (khalas/sukkari)", unit: "1 date ≈ 10 g (medjool ≈ 24 g)", kcal: [280, 300], protein: [1.8, 2.5], carbs: [70, 75], fat: [0.2, 0.4] },
  { id: "rice_white", names: "رز أبيض مطبوخ cooked white rice", unit: "medium plate ≈ 250 g, cup ≈ 160 g", kcal: [128, 135], protein: [2.6, 2.8], carbs: [28, 29], fat: [0.3, 0.5] },
  { id: "machboos_chicken", names: "مجبوس / كبسة دجاج chicken machboos/kabsa (rice + chicken)", unit: "medium plate ≈ 400 g", kcal: [160, 180], protein: [9, 11], carbs: [19, 22], fat: [5, 7] },
  { id: "mandi_meat", names: "مندي لحم meat mandi (rice + meat)", unit: "medium plate ≈ 400 g", kcal: [190, 210], protein: [10, 12], carbs: [18, 20], fat: [8, 10] },
  { id: "shawarma_chicken", names: "شاورما دجاج chicken shawarma sandwich", unit: "1 regular sandwich ≈ 200 g, Arabic plate ≈ 350 g", kcal: [215, 240], protein: [12, 14], carbs: [20, 24], fat: [9, 11] },
  { id: "falafel", names: "فلافل falafel", unit: "1 piece ≈ 17 g", kcal: [320, 335], protein: [13, 13.5], carbs: [31, 32], fat: [17, 18] },
  { id: "samosa", names: "سمبوسة samosa (fried)", unit: "1 piece ≈ 30 g", kcal: [260, 300], protein: [5, 7], carbs: [28, 32], fat: [14, 17] },
  { id: "karak", names: "كرك karak tea (milk + sugar)", unit: "1 cup ≈ 150 ml (100 ml ≈ 100 g)", kcal: [75, 90], protein: [1.8, 2.2], carbs: [12, 14], fat: [2.2, 3] },
  { id: "harees", names: "هريس harees", unit: "1 bowl ≈ 300 g", kcal: [110, 130], protein: [6, 7], carbs: [13, 15], fat: [3.5, 5] },
  { id: "arabic_bread", names: "خبز عربي pita bread", unit: "1 loaf ≈ 60 g", kcal: [270, 280], protein: [9, 9.5], carbs: [55, 57], fat: [1.1, 1.5] },
  { id: "egg_boiled", names: "بيض مسلوق boiled egg", unit: "1 egg ≈ 50 g", kcal: [150, 158], protein: [12.5, 13], carbs: [1, 1.2], fat: [10.5, 11] },
  { id: "chicken_breast_grilled", names: "صدر دجاج مشوي grilled chicken breast", unit: "1 breast ≈ 170 g", kcal: [160, 170], protein: [30, 31.5], carbs: [0, 0], fat: [3.5, 4] },
  { id: "fries", names: "بطاطس مقلية french fries", unit: "medium portion ≈ 115 g", kcal: [300, 320], protein: [3.3, 3.6], carbs: [40, 42], fat: [14.5, 15.5] },
  { id: "burger_beef", names: "برجر لحم beef burger sandwich", unit: "1 regular burger ≈ 220 g", kcal: [250, 280], protein: [13, 15], carbs: [24, 28], fat: [11, 13] },
  { id: "pizza_margherita", names: "بيتزا مارغريتا margherita pizza", unit: "1 slice ≈ 105 g", kcal: [255, 270], protein: [10.5, 11.5], carbs: [32, 34], fat: [9.5, 10.5] },
  { id: "hummus", names: "حمص بالطحينة hummus", unit: "1 tbsp ≈ 15 g, small bowl ≈ 150 g", kcal: [160, 170], protein: [7.5, 8], carbs: [14, 15], fat: [9.5, 10] },
  { id: "kunafa", names: "كنافة kunafa", unit: "1 piece ≈ 120 g", kcal: [350, 390], protein: [6, 8], carbs: [40, 46], fat: [18, 21] },
  { id: "milk_full", names: "حليب كامل الدسم whole milk", unit: "1 cup ≈ 250 g", kcal: [60, 64], protein: [3.2, 3.4], carbs: [4.7, 5], fat: [3.2, 3.4] },
  { id: "banana", names: "موز banana", unit: "1 medium ≈ 118 g", kcal: [88, 90], protein: [1.1, 1.1], carbs: [22.5, 23], fat: [0.3, 0.3] },
  { id: "apple", names: "تفاح apple", unit: "1 medium ≈ 180 g", kcal: [52, 54], protein: [0.3, 0.3], carbs: [13.8, 14], fat: [0.2, 0.2] },
  { id: "indomie", names: "اندومي indomie instant noodles (per DRY weight)", unit: "1 pack = 75-80 g dry", kcal: [460, 475], protein: [8.5, 10], carbs: [60, 64], fat: [19, 21] },
];

const BY_ID = new Map(FOOD_REFERENCE.map((f) => [f.id, f]));
export const refFood = (id: string | undefined) => (id ? BY_ID.get(id.trim().toLowerCase()) : undefined);

/** الجدول بصيغة قصيرة لـ Gemini */
export function referenceTable(): string {
  return FOOD_REFERENCE.map((f) => `${f.id}: ${f.names} — ${f.unit}`).join("\n");
}
