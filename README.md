# ساحة الخدع

لعبة بطاقات عربية مستوحاة من أجواء التحقيق والمافيا، بأسلوب مواجهة قريب من Hearthstone، ضد بوت داخل المتصفح.

## تشغيل محلي

```bash
npm install
npm test
npx next build
```

ولفتح النسخة المصدرة مباشرة:

- افتح `out/index.html`

## إضافة صور البطاقات

ضع الصور داخل `public/cards/` بنفس أسماء معرفات البطاقات:

- `public/cards/street_informant.webp`
- `public/cards/shadow_blade.webp`
- `public/cards/masked_judge.webp`

وإذا لم توجد صورة لبطاقة معينة، سيظهر تلقائياً ملف placeholder.

## النشر على GitHub Pages

1. ارفع المشروع إلى GitHub.
2. تأكد أن الفرع الرئيسي اسمه `main`.
3. من إعدادات المستودع افتح `Settings > Pages`.
4. في خانة Source اختر `GitHub Actions`.
5. أي push جديد إلى `main` سيشغّل workflow النشر الموجود في `.github/workflows/deploy-pages.yml`.

الـ workflow يبني الموقع كنسخة static مناسبة لـ GitHub Pages ويشغّل الاختبارات قبل النشر.
