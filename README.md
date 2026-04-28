# ساحة الخدع

لعبة بطاقات عربية ضد بوت داخل المتصفح، مبنية بـ Next.js وTypeScript، وتستخدم تصدير static مناسب لـ GitHub Pages.

## التشغيل المحلي

```bash
npm install
npm test
npm run build
```

بعد البناء ستجد النسخة المصدرة داخل `out/`.

## صور البطاقات

ضع صور البطاقات داخل `public/cards/` بنفس أسماء معرفات البطاقات، مثل:

- `public/cards/thief.webp`
- `public/cards/doctor.webp`
- `public/cards/guard.webp`
- `public/cards/shadow_blade.webp`
- `public/cards/masked_judge.webp`

إذا لم توجد صورة لبطاقة معينة فسيظهر تلقائيًا الملف `card-placeholder.svg`.

## النشر على GitHub Pages

1. تأكد أن الفرع الرئيسي هو `main`.
2. افتح `Settings > Pages` في GitHub.
3. اختر `GitHub Actions` كمصدر للنشر.
4. أي `push` جديد إلى `main` سيشغّل الملف `.github/workflows/deploy-pages.yml`.

الـ workflow يقوم بتثبيت الاعتمادات، تشغيل الاختبارات، بناء النسخة static، ثم نشرها على GitHub Pages.
