# اخبار ایرلند به فارسی (Ireland News Persian)

سرویس خبری خودکار که خبرهای ایرلند و ایرلند شمالی را از منابع معتبر جمع می‌کند، با هوش مصنوعی Claude به فارسی روان می‌نویسد، روی وب‌سایت منتشر می‌کند و در تلگرام می‌فرستد.

## ساختار پروژه

| پوشه | کار |
| --- | --- |
| `src/app` | صفحه‌های وب‌سایت (Next.js) |
| `src/components` | اجزای ظاهری سایت |
| `src/lib` | منطق مشترک: دسته‌ها، تاریخ فارسی، راست‌به‌چپ (`bidi.ts`)، خواندن خبر از پایگاه داده |
| `scripts` | موتور خبر: خواندن منابع، فیلتر، ترجمه، انتشار در تلگرام |
| `scripts/sources.ts` | فهرست منابع خبری |
| `supabase/schema.sql` | ساختار پایگاه داده |
| `.github/workflows` | اجرای خودکار موتور خبر هر ۳۰ دقیقه |

## مدل انتشار (حقوقی)

- منابع با مجوز آزاد (`kind: "open"`): ترجمه کامل و وفادار.
- رسانه‌ها (`kind: "media"`): گزارش فارسی مستقل با همه واقعیت‌ها، بدون کپی جمله‌به‌جمله، با لینک به منبع.
- به‌طور پیش‌فرض انتشار کاملاً خودکار است؛ خبرهایی که فقط از روی تیتر نوشته شده‌اند منتشر نمی‌شوند. برای فعال کردن تأیید دستی: `REQUIRE_REVIEW=true`.

## اجرای سایت روی کامپیوتر خودتان

```bash
npm install
npm run dev
```

سپس `http://localhost:3000` را باز کنید. تا وقتی پایگاه داده وصل نشده، سایت با مطالب نمونه نمایش داده می‌شود.

## راه‌اندازی کامل (یک بار)

1. **Supabase**: یک پروژه بسازید. در SQL Editor محتوای `supabase/schema.sql` را اجرا کنید. از Project Settings → API این سه مقدار را بردارید: `Project URL`، `anon key`، `service_role key`.
2. **Anthropic**: در console.anthropic.com کلید API بسازید و سقف هزینه ماهانه تنظیم کنید.
3. **تلگرام**: با @BotFather یک ربات بسازید، توکن را بردارید، ربات را مدیر کانال کنید.
4. **GitHub → Settings → Secrets and variables → Actions**:
   - Secrets: `ANTHROPIC_API_KEY`، `SUPABASE_URL`، `SUPABASE_SERVICE_ROLE_KEY`، `TELEGRAM_BOT_TOKEN`، `REVALIDATE_SECRET`
   - Variables: `SITE_URL`، `TELEGRAM_CHANNEL_ID` (مثلاً `@irelandnewspersian`)، `REQUIRE_REVIEW`
5. **Vercel**: مخزن را import کنید و متغیرهای `NEXT_PUBLIC_*` و `REVALIDATE_SECRET` را از `.env.example` وارد کنید.

## تأیید خبرها

در Supabase → Table Editor → `articles`، خبرهای با وضعیت `pending_review` را ببینید. برای انتشار، `status` را به `published` تغییر دهید (زمان انتشار خودکار ثبت می‌شود). برای رد، `rejected`.

## دستورهای مفید

| دستور | کار |
| --- | --- |
| `npm run dev` | اجرای سایت |
| `npm run try -- <url>` | امتحان ترجمه یک خبر بدون پایگاه داده (فقط کلید Anthropic لازم است) |
| `npm run check-sources` | بررسی سالم بودن همه منابع خبری |
| `npm run ingest` | یک بار اجرای موتور خبر |
| `npm run post:telegram` | ارسال خبرهای منتشرشده به تلگرام |
| `npm test` / `npm run typecheck` / `npm run lint` | آزمون‌ها و بررسی کد |

## سئو (موتورهای جستجو)

کارهایی که در کد انجام شده: عنوان و توضیح صفحه اصلی با عبارت‌های «اخبار ایرلند»، «اخبار ایرلند فارسی» و «ایرلند»؛ عنوان جدا برای هر دسته (مثلاً «اخبار مهاجرت ایرلند»)؛ داده ساختاریافته (`NewsMediaOrganization`، `WebSite`، `NewsArticle`، `BreadcrumbList`، `CollectionPage`)؛ نقشه سایت کامل و نقشه Google News؛ آرشیو صفحه‌بندی‌شده (`/news` و `/category/<slug>/page/<n>`)؛ پاسخ ۴۰۴ واقعی برای صفحه‌های ناموجود؛ و ارسال خودکار نشانی خبرهای تازه به IndexNow (Bing و Yandex) بعد از هر انتشار.

کارهای یک‌باره بیرون از کد:

1. **Google Search Console**: سایت را (ترجیحاً به‌صورت Domain property) اضافه و تأیید کنید، یا کد تأیید را در Vercel در `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` بگذارید. بعد در بخش Sitemaps این دو را ثبت کنید: `sitemap.xml` و `news-sitemap.xml`. برای صفحه اصلی و چند دسته مهم «Request indexing» بزنید.
2. **Bing Webmaster Tools**: سایت را از Search Console وارد (Import) کنید یا کد را در `NEXT_PUBLIC_BING_SITE_VERIFICATION` بگذارید. IndexNow خودکار کار می‌کند و کلیدش در `/indexnow-key.txt` است.
3. **Google Publisher Center**: نشریه را با نام «اخبار ایرلند به فارسی» ثبت کنید تا شانس دیده شدن در Google News بیشتر شود.
4. **لینک از بیرون**: لینک سایت را در بیو کانال تلگرام، اینستاگرام، ایکس و صفحه‌های گروه‌های ایرانیان ایرلند بگذارید؛ لینک از سایت‌های دیگر مهم‌ترین عامل بیرونی رتبه است.
