import type { Article } from "@/lib/types";

/**
 * Demo content shown only while no database is connected.
 * These are evergreen explainers written for the demo, not news reports.
 * The site shows a "demo" banner whenever this data is used.
 */
const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

const base = {
  status: "published" as const,
  source_name: "محتوای نمونه",
  source_url: "",
  image_url: null,
  image_credit: null,
};

export const SAMPLE_ARTICLES: Article[] = [
  {
    ...base,
    id: "s1",
    slug: "welcome-ireland-news-persian",
    title_fa: "«اخبار ایرلند به فارسی» به زودی راه‌اندازی می‌شود",
    summary_fa:
      "یک سرویس خبری تازه، خبرهای معتبر ایرلند و ایرلند شمالی را هر روز به فارسی روان منتشر می‌کند؛ با تمرکز ویژه بر خبرهایی که برای مهاجران و ایرانیان مقیم ایرلند مهم است.",
    body_fa: `«اخبار ایرلند به فارسی» (Ireland News Persian) سرویسی است که خبرهای ایرلند و ایرلند شمالی را از منابع معتبر جمع‌آوری می‌کند و به فارسی روان منتشر می‌کند.

## چه خبرهایی منتشر می‌شود؟

- اقتصاد، بازار کار و هزینه زندگی
- قوانین تازه، مالیات و حقوق شهروندان
- مهاجرت، اقامت و شهروندی
- مسکن و اجاره
- ورزش، فرهنگ و رویدادها
- خبرهای جامعه ایرانی ایرلند

## منابع ما

خبرها از منابعی مانند RTÉ، BBC News NI، وب‌سایت رسمی دولت gov.ie و Citizens Information گرفته می‌شوند. زیر هر خبر نام منبع و لینک خبر اصلی آمده است.

> هدف ما این است که هیچ ایرانی در ایرلند به خاطر زبان، از خبرهای مهم زندگی‌اش جا نماند.`,
    category: "community",
    tags: ["معرفی", "جامعه ایرانی"],
    immigrant_relevance: 2,
    importance: 3,
    mode: "report",
    source_title: "",
    published_at: hoursAgo(1),
    created_at: hoursAgo(1),
  },
  {
    ...base,
    id: "s2",
    slug: "guide-irp-online-renewal",
    title_fa: "راهنما: تمدید اجازه اقامت (IRP) به صورت آنلاین",
    summary_fa:
      "بیشتر مهاجران غیراروپایی در ایرلند می‌توانند اجازه اقامت خود را از طریق سامانه آنلاین اداره مهاجرت تمدید کنند. در این راهنما مراحل کلی و مدارک معمول را مرور می‌کنیم.",
    body_fa: `اجازه اقامت ایرلند که با نام Irish Residence Permit یا IRP شناخته می‌شود، برای اتباع غیر اروپایی که بیش از ۹۰ روز در ایرلند می‌مانند الزامی است.

## مراحل کلی تمدید

- ورود به سامانه آنلاین تمدید در وب‌سایت Irish Immigration Service
- بارگذاری تصویر گذرنامه و کارت IRP فعلی
- بارگذاری مدارک مربوط به نوع اقامت (مثلاً نامه کارفرما یا دانشگاه)
- پرداخت هزینه به صورت آنلاین
- ارسال گذرنامه و دریافت کارت جدید از طریق پست

## نکته مهم

درخواست تمدید را چند هفته پیش از پایان اعتبار کارت ثبت کنید. شرایط دقیق و هزینه‌ها ممکن است تغییر کند؛ همیشه آخرین اطلاعات را در وب‌سایت رسمی irishimmigration.ie بررسی کنید.`,
    category: "immigration",
    tags: ["اقامت", "IRP", "راهنما"],
    immigrant_relevance: 3,
    importance: 4,
    mode: "report",
    source_title: "",
    published_at: hoursAgo(3),
    created_at: hoursAgo(3),
  },
  {
    ...base,
    id: "s3",
    slug: "guide-pps-number",
    title_fa: "شماره PPS چیست و چطور می‌توان آن را گرفت؟",
    summary_fa:
      "شماره PPS کلید دسترسی به کار، مالیات و خدمات عمومی در ایرلند است. هر کسی که در ایرلند کار می‌کند به آن نیاز دارد.",
    body_fa: `شماره خدمات عمومی شخصی یا Personal Public Service Number که به اختصار PPS Number گفته می‌شود، یک شناسه منحصربه‌فرد برای هر فرد در ایرلند است.

## چه کاربردی دارد؟

- شروع به کار و پرداخت درست مالیات از طریق Revenue
- دسترسی به خدمات درمانی عمومی
- دریافت کمک‌هزینه‌های دولتی

## چطور درخواست بدهیم؟

درخواست از طریق وب‌سایت MyWelfare.ie ثبت می‌شود و معمولاً به حساب کاربری تأییدشده (MyGovID) نیاز دارد. مدرک هویتی و مدرک نشانی محل سکونت از مدارک رایج این درخواست هستند.`,
    category: "economy",
    tags: ["PPS", "کار", "راهنما"],
    immigrant_relevance: 3,
    importance: 3,
    mode: "report",
    source_title: "",
    published_at: hoursAgo(6),
    created_at: hoursAgo(6),
  },
  {
    ...base,
    id: "s4",
    slug: "halloween-irish-roots",
    title_fa: "هالووین؛ جشنی با ریشه‌های ایرلندی",
    summary_fa:
      "امشب ۳۱ اکتبر شب هالووین است؛ جشنی که ریشه آن به جشن باستانی «سَوین» (Samhain) در ایرلند بازمی‌گردد.",
    body_fa: `هالووین امروز در سراسر جهان شناخته‌شده است، اما ریشه آن به جشن باستانی Samhain در ایرلند برمی‌گردد؛ جشنی که پایان فصل برداشت و آغاز زمستان را نشان می‌داد.

## در ایرلند امروز

- شهر Derry در ایرلند شمالی یکی از بزرگ‌ترین جشنواره‌های هالووین اروپا را برگزار می‌کند.
- کودکان با لباس‌های مبدل به در خانه‌ها می‌روند و شیرینی می‌گیرند.
- آتش‌بازی در این شب رایج است؛ اما استفاده از ترقه بدون مجوز در جمهوری ایرلند غیرقانونی است.

اگر کودک دارید، این شب فرصت خوبی برای آشنایی خانواده با فرهنگ ایرلند است.`,
    category: "culture",
    tags: ["هالووین", "فرهنگ"],
    immigrant_relevance: 1,
    importance: 2,
    mode: "report",
    source_title: "",
    published_at: hoursAgo(8),
    created_at: hoursAgo(8),
  },
  {
    ...base,
    id: "s5",
    slug: "northern-ireland-travel-rules",
    title_fa: "سفر به ایرلند شمالی؛ مهاجران چه مدارکی لازم دارند؟",
    summary_fa:
      "ایرلند شمالی بخشی از بریتانیاست و قوانین ورود آن با جمهوری ایرلند فرق دارد. بیشتر مهاجران غیراروپایی برای سفر به بلفاست به مجوز ورود بریتانیا نیاز دارند.",
    body_fa: `مرز زمینی میان جمهوری ایرلند و ایرلند شمالی بازرسی ثابت ندارد، اما این به معنای آزاد بودن ورود برای همه نیست.

## نکته‌های مهم

- ایرلند شمالی بخشی از United Kingdom است و واحد پول آن پوند استرلینگ است.
- اجازه اقامت ایرلند (IRP) به‌تنهایی مجوز ورود به بریتانیا نیست.
- اتباع بسیاری از کشورها، از جمله ایران، برای ورود به ایرلند شمالی به ویزای بریتانیا یا مجوز سفر الکترونیکی (ETA) نیاز دارند.

پیش از سفر، شرایط را در وب‌سایت رسمی gov.uk بررسی کنید.`,
    category: "northern-ireland",
    tags: ["سفر", "ویزا", "بلفاست"],
    immigrant_relevance: 3,
    importance: 3,
    mode: "report",
    source_title: "",
    published_at: hoursAgo(12),
    created_at: hoursAgo(12),
  },
  {
    ...base,
    id: "s6",
    slug: "dublin-tech-hub",
    title_fa: "چرا دوبلین مقر اروپایی غول‌های فناوری است؟",
    summary_fa:
      "شرکت‌هایی مانند Google، Meta و Apple مقر اروپایی خود را در ایرلند دارند. این شرکت‌ها از بزرگ‌ترین کارفرمایان متخصصان مهاجر هستند.",
    body_fa: `ایرلند در دو دهه گذشته به یکی از مهم‌ترین مراکز فناوری اروپا تبدیل شده است.

## دلایل اصلی

- نرخ مالیات شرکتی رقابتی
- نیروی کار جوان و انگلیسی‌زبان
- عضویت در اتحادیه اروپا

برای متخصصان مهاجر، این شرکت‌ها از طریق مجوز کار Critical Skills Employment Permit فرصت‌های شغلی فراوانی فراهم می‌کنند.`,
    category: "tech",
    tags: ["فناوری", "کار", "دوبلین"],
    immigrant_relevance: 2,
    importance: 2,
    mode: "report",
    source_title: "",
    published_at: hoursAgo(20),
    created_at: hoursAgo(20),
  },
];
