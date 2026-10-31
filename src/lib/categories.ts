export interface Category {
  slug: string;
  name: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  { slug: "ireland", name: "ایرلند", description: "مهم‌ترین خبرهای روز جمهوری ایرلند" },
  { slug: "northern-ireland", name: "ایرلند شمالی", description: "خبرهای بلفاست و ایرلند شمالی" },
  { slug: "immigration", name: "مهاجرت و اقامت", description: "ویزا، اقامت، شهروندی و قوانین مهاجرت" },
  { slug: "politics", name: "سیاست", description: "دولت، مجلس (Oireachtas) و احزاب" },
  { slug: "economy", name: "اقتصاد و کار", description: "اقتصاد، بازار کار، مالیات و هزینه زندگی" },
  { slug: "housing", name: "مسکن", description: "اجاره، خرید خانه و قوانین مسکن" },
  { slug: "law", name: "قوانین و حقوق", description: "قانون‌های تازه و حقوق شهروندان" },
  { slug: "health", name: "سلامت", description: "خدمات درمانی و HSE" },
  { slug: "sport", name: "ورزش", description: "فوتبال، راگبی، GAA و ورزش‌های دیگر" },
  { slug: "culture", name: "فرهنگ و هنر", description: "فرهنگ، هنر، رویدادها و جامعه" },
  { slug: "tech", name: "فناوری", description: "شرکت‌های فناوری و استارتاپ‌ها" },
  { slug: "community", name: "جامعه ایرانی", description: "رویدادها و خبرهای ایرانیان ایرلند" },
];

export const NAV_CATEGORIES = ["ireland", "immigration", "economy", "housing", "politics", "northern-ireland", "sport", "culture"];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryName(slug: string): string {
  return getCategory(slug)?.name ?? "ایرلند";
}
