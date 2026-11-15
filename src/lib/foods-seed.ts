// قاعدة الأكلات الشائعة. كل القيم لكل 100 غ (تقريبية، من جداول التغذية المعروفة)
// serving: حصة شائعة تُستخدم في الاقتراحات وكقيمة افتراضية إذا ما كتبت الوزن

export interface SeedFood {
  name: string;
  aliases?: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  serving?: { grams: number; label: string };
}

export const SEED_FOODS: SeedFood[] = [
  // بيض وألبان
  { name: "بيض", aliases: ["بيضة", "بيضات", "بيض مسلوق", "بيض مقلي", "بيض كامل"], kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, serving: { grams: 50, label: "بيضة" } },
  { name: "بياض بيض", aliases: ["بياض البيض"], kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, serving: { grams: 33, label: "بياض بيضة" } },
  { name: "حليب كامل الدسم", aliases: ["حليب", "حليب كامل"], kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, serving: { grams: 250, label: "كوب حليب" } },
  { name: "حليب قليل الدسم", aliases: ["حليب لايت"], kcal: 42, protein: 3.4, carbs: 5, fat: 1, serving: { grams: 250, label: "كوب حليب قليل الدسم" } },
  { name: "زبادي عادي", aliases: ["زبادي", "روب", "لبن زبادي"], kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, serving: { grams: 170, label: "علبة زبادي" } },
  { name: "زبادي يوناني", aliases: ["زبادي اغريقي", "يوناني"], kcal: 73, protein: 10, carbs: 3.9, fat: 2, serving: { grams: 170, label: "علبة زبادي يوناني" } },
  { name: "لبنة", aliases: ["لبنه"], kcal: 160, protein: 6.5, carbs: 4.5, fat: 13, serving: { grams: 30, label: "ملعقتين لبنة" } },
  { name: "جبن أبيض", aliases: ["جبنة بيضاء", "جبن", "جبنة", "فيتا", "جبنة فيتا"], kcal: 264, protein: 14.2, carbs: 4.1, fat: 21.3, serving: { grams: 30, label: "قطعة جبن" } },
  { name: "جبن شيدر", aliases: ["شيدر", "جبنة شيدر"], kcal: 403, protein: 25, carbs: 1.3, fat: 33, serving: { grams: 20, label: "شريحة شيدر" } },
  { name: "جبن قريش", aliases: ["قريش", "كوتج", "جبنة قريش"], kcal: 98, protein: 11.1, carbs: 3.4, fat: 4.3, serving: { grams: 100, label: "نصف كوب قريش" } },

  // لحوم ودواجن وأسماك
  { name: "صدر دجاج مطبوخ", aliases: ["صدر دجاج", "دجاج صدر", "صدر دجاج مشوي", "دجاج مشوي", "دجاج", "صدور دجاج"], kcal: 165, protein: 31, carbs: 0, fat: 3.6, serving: { grams: 120, label: "قطعة صدر دجاج" } },
  { name: "صدر دجاج نيء", aliases: ["صدر دجاج ني"], kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 },
  { name: "أفخاذ دجاج مطبوخة", aliases: ["افخاذ دجاج", "فخذ دجاج", "أفخاذ", "دجاج افخاذ", "وراك دجاج"], kcal: 209, protein: 26, carbs: 0, fat: 10.9, serving: { grams: 120, label: "فخذين دجاج" } },
  { name: "تونة معلبة بالماء", aliases: ["تونة", "تونه", "علبة تونة", "تونة بالماء", "تونة معلبة"], kcal: 116, protein: 25.5, carbs: 0, fat: 0.8, serving: { grams: 100, label: "علبة تونة" } },
  { name: "تونة بالزيت", aliases: ["تونة زيت"], kcal: 198, protein: 29, carbs: 0, fat: 8.2, serving: { grams: 100, label: "علبة تونة بالزيت" } },
  { name: "لحم مفروم مطبوخ", aliases: ["لحم مفروم", "كفتة", "لحم بقر مفروم"], kcal: 250, protein: 26, carbs: 0, fat: 15, serving: { grams: 100, label: "حصة لحم مفروم" } },
  { name: "لحم بقر مطبوخ", aliases: ["لحم", "لحم بقر", "ستيك"], kcal: 217, protein: 26, carbs: 0, fat: 12, serving: { grams: 120, label: "قطعة لحم" } },
  { name: "سمك أبيض مطبوخ", aliases: ["سمك", "فيليه سمك", "هامور", "بلطي"], kcal: 105, protein: 23, carbs: 0, fat: 1, serving: { grams: 150, label: "قطعة سمك" } },
  { name: "سلمون مطبوخ", aliases: ["سلمون"], kcal: 206, protein: 22, carbs: 0, fat: 12, serving: { grams: 120, label: "قطعة سلمون" } },

  // نشويات
  { name: "رز أبيض مطبوخ", aliases: ["رز", "أرز", "ارز", "رز ابيض", "رز مطبوخ", "أرز أبيض"], kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: { grams: 150, label: "صحن رز" } },
  { name: "رز بني مطبوخ", aliases: ["رز بني", "ارز بني"], kcal: 123, protein: 2.7, carbs: 25.6, fat: 1, serving: { grams: 150, label: "صحن رز بني" } },
  { name: "خبز أسمر", aliases: ["خبز اسمر", "خبز بر", "خبز قمح كامل", "توست اسمر", "خبز بني"], kcal: 247, protein: 13, carbs: 41, fat: 3.4, serving: { grams: 60, label: "رغيف أسمر" } },
  { name: "خبز أبيض", aliases: ["خبز", "خبز عربي", "صامولي", "توست"], kcal: 275, protein: 9, carbs: 55, fat: 1.2, serving: { grams: 60, label: "رغيف" } },
  { name: "مكرونة مطبوخة", aliases: ["مكرونة", "معكرونة", "باستا"], kcal: 158, protein: 5.8, carbs: 31, fat: 0.9, serving: { grams: 200, label: "صحن مكرونة" } },
  { name: "شوفان", aliases: ["شوفان جاف", "اوتس"], kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9, serving: { grams: 40, label: "نصف كوب شوفان" } },
  { name: "بطاطس مسلوقة", aliases: ["بطاطس", "بطاطا", "بطاطس مشوية"], kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, serving: { grams: 150, label: "حبة بطاطس" } },

  // بقوليات
  { name: "فول مدمس", aliases: ["فول", "فول مطبوخ"], kcal: 110, protein: 7.6, carbs: 19.7, fat: 0.4, serving: { grams: 200, label: "صحن فول" } },
  { name: "عدس مطبوخ", aliases: ["عدس", "شوربة عدس"], kcal: 116, protein: 9, carbs: 20, fat: 0.4, serving: { grams: 200, label: "صحن عدس" } },
  { name: "حمص مطبوخ", aliases: ["حمص حب", "حمص مسلوق", "حمص"], kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6, serving: { grams: 150, label: "صحن حمص حب" } },
  { name: "حمص بالطحينة", aliases: ["حمص متبل", "حمص مهروس"], kcal: 166, protein: 7.9, carbs: 14.3, fat: 9.6, serving: { grams: 100, label: "صحن حمص صغير" } },

  // فواكه
  { name: "تمر", aliases: ["تمرة", "تمرات"], kcal: 282, protein: 2.5, carbs: 75, fat: 0.4, serving: { grams: 30, label: "3 تمرات" } },
  { name: "موز", aliases: ["موزة", "موزه"], kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, serving: { grams: 120, label: "موزة" } },
  { name: "تفاح", aliases: ["تفاحة", "تفاحه"], kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, serving: { grams: 180, label: "تفاحة" } },
  { name: "برتقال", aliases: ["برتقالة"], kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1, serving: { grams: 150, label: "برتقالة" } },

  // مكسرات ودهون
  { name: "مكسرات مشكلة", aliases: ["مكسرات", "نقل"], kcal: 607, protein: 20, carbs: 21, fat: 54, serving: { grams: 30, label: "حفنة مكسرات" } },
  { name: "لوز", aliases: ["لوز نيء"], kcal: 579, protein: 21, carbs: 21.6, fat: 49.9, serving: { grams: 30, label: "حفنة لوز" } },
  { name: "فول سوداني", aliases: ["فستق سوداني", "فول سوداني محمص"], kcal: 567, protein: 25.8, carbs: 16, fat: 49, serving: { grams: 30, label: "حفنة فول سوداني" } },
  { name: "زبدة فول سوداني", aliases: ["زبدة الفول السوداني", "بينت بتر"], kcal: 588, protein: 25, carbs: 20, fat: 50, serving: { grams: 32, label: "ملعقتين زبدة فول سوداني" } },
  { name: "زيت زيتون", aliases: ["زيت"], kcal: 884, protein: 0, carbs: 0, fat: 100, serving: { grams: 13, label: "ملعقة زيت" } },
  { name: "عسل", aliases: ["عسل نحل"], kcal: 304, protein: 0.3, carbs: 82, fat: 0, serving: { grams: 20, label: "ملعقة عسل" } },

  // خضار
  { name: "خيار", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, serving: { grams: 100, label: "خيارة" } },
  { name: "طماطم", aliases: ["طماطة", "بندورة"], kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, serving: { grams: 120, label: "حبة طماطم" } },
  { name: "خس", kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { name: "جزر", kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, serving: { grams: 60, label: "جزرة" } },
  { name: "بروكلي", aliases: ["بروكلي مطبوخ", "قرنبيط اخضر"], kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  { name: "سبانخ", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: "بصل", kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  { name: "فلفل رومي", aliases: ["فلفل حلو", "فليفلة"], kcal: 31, protein: 1, carbs: 6, fat: 0.3 },
  { name: "سلطة خضراء", aliases: ["سلطة", "سلطه"], kcal: 20, protein: 1, carbs: 4, fat: 0.2, serving: { grams: 150, label: "صحن سلطة" } },
];
