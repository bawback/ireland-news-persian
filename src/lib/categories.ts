export interface Category {
  slug: string;
  name: string;
  description: string;
  /** Page heading and the start of the page title: the phrase people search for, e.g. «اخبار اقتصادی ایرلند». */
  heading: string;
  /** Text for the page's meta description and intro paragraph. */
  seoDescription: string;
}

export const CATEGORIES: Category[] = [
  { slug: "ireland", name: "ایرلند", description: "مهم‌ترین خبرهای روز جمهوری ایرلند", heading: "اخبار ایرلند امروز", seoDescription: "اخبار ایرلند امروز به فارسی: مهم‌ترین و تازه‌ترین خبرهای جمهوری ایرلند و دابلین، از دولت و جامعه تا رویدادهای روز، از منابع معتبر ایرلندی." },
  { slug: "northern-ireland", name: "ایرلند شمالی", description: "خبرهای بلفاست و ایرلند شمالی", heading: "اخبار ایرلند شمالی", seoDescription: "اخبار ایرلند شمالی به فارسی: تازه‌ترین خبرهای بلفاست و ایرلند شمالی، سیاست، اقتصاد و جامعه، از منابع معتبر." },
  { slug: "immigration", name: "مهاجرت و اقامت", description: "ویزا، اقامت، شهروندی و قوانین مهاجرت", heading: "اخبار مهاجرت ایرلند", seoDescription: "اخبار مهاجرت به ایرلند به فارسی: ویزا، اقامت و استمپ، اجازه کار، شهروندی و تغییر قوانین مهاجرت ایرلند، مهم برای ایرانیان و مهاجران." },
  { slug: "politics", name: "سیاست", description: "دولت، مجلس (Oireachtas) و احزاب", heading: "اخبار سیاسی ایرلند", seoDescription: "اخبار سیاسی ایرلند به فارسی: دولت، مجلس (Oireachtas)، احزاب و انتخابات ایرلند، از منابع معتبر." },
  { slug: "economy", name: "اقتصاد و کار", description: "اقتصاد، بازار کار، مالیات و هزینه زندگی", heading: "اخبار اقتصادی ایرلند", seoDescription: "اخبار اقتصادی ایرلند به فارسی: اقتصاد، بازار کار، حقوق و مالیات، تورم و هزینه زندگی در ایرلند." },
  { slug: "housing", name: "مسکن", description: "اجاره، خرید خانه و قوانین مسکن", heading: "اخبار مسکن ایرلند", seoDescription: "اخبار مسکن ایرلند به فارسی: اجاره خانه، قیمت مسکن، خرید خانه و قوانین تازه مسکن در دابلین و سراسر ایرلند." },
  { slug: "law", name: "قوانین و حقوق", description: "قانون‌های تازه و حقوق شهروندان", heading: "اخبار قوانین ایرلند", seoDescription: "اخبار قوانین و حقوق در ایرلند به فارسی: قانون‌های تازه، حقوق شهروندان، کارگران و مستأجران." },
  { slug: "health", name: "سلامت", description: "خدمات درمانی و HSE", heading: "اخبار سلامت ایرلند", seoDescription: "اخبار سلامت و درمان ایرلند به فارسی: HSE، بیمارستان‌ها، پزشک عمومی (GP) و خدمات درمانی." },
  { slug: "sport", name: "ورزش", description: "فوتبال، راگبی، GAA و ورزش‌های دیگر", heading: "اخبار ورزشی ایرلند", seoDescription: "اخبار ورزشی ایرلند به فارسی: فوتبال، راگبی، GAA و ورزش‌های دیگر ایرلند و ایرلند شمالی." },
  { slug: "entertainment", name: "سرگرمی و رویدادها", description: "کنسرت‌ها، رویدادها و خبرهای جالب و سرگرم‌کننده دابلین و ایرلند", heading: "رویدادها و سرگرمی در ایرلند", seoDescription: "رویدادها، کنسرت‌ها و خبرهای جالب و سرگرم‌کننده دابلین و ایرلند به فارسی." },
  { slug: "culture", name: "فرهنگ و هنر", description: "فرهنگ، هنر و جامعه", heading: "اخبار فرهنگی ایرلند", seoDescription: "اخبار فرهنگ و هنر ایرلند به فارسی: هنر، ادبیات، موسیقی، جشنواره‌ها و جامعه." },
  { slug: "tech", name: "فناوری", description: "شرکت‌های فناوری و استارتاپ‌ها", heading: "اخبار فناوری ایرلند", seoDescription: "اخبار فناوری ایرلند به فارسی: شرکت‌های فناوری، استارتاپ‌ها و بازار کار IT در ایرلند." },
  { slug: "community", name: "جامعه ایرانی", description: "رویدادها و خبرهای ایرانیان ایرلند", heading: "اخبار ایرانیان ایرلند", seoDescription: "اخبار ایرانیان ایرلند: رویدادها و خبرهای جامعه ایرانی و فارسی‌زبان در دابلین و سراسر ایرلند." },
];

export const NAV_CATEGORIES = ["ireland", "immigration", "entertainment", "economy", "housing", "politics", "northern-ireland", "sport", "culture"];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryName(slug: string): string {
  return getCategory(slug)?.name ?? "ایرلند";
}
