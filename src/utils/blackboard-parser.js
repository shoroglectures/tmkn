import * as XLSX from 'xlsx';

/**
 * محلّل ملفات Blackboard
 * يدعم CSV + XLS + XLSX
 * يتعرّف على الأعمدة تلقائياً
 */

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, {
          type: 'array',
          raw: false,
          codepage: 65001,
        });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** يكشف نوع العمود من اسمه */
function detectColumnType(name) {
  const n = String(name);

  if (n.includes('اسم العائلة') || n.includes('الاسم الأول') || n.includes('اسم المستخدم')) {
    return 'identity';
  }
  if (n.includes('آخر وصول') || n.includes('الإتاحة') || n.includes('معرف الطالب')) {
    return 'ignore';
  }
  if (n.includes('المجموع من 100')) return 'total_100';
  if (n.includes('المجموع من 60'))  return 'total_60';
  if (n.includes('نهائي'))          return 'final';
  if (n.includes('اختبار') && n.includes('الاول'))  return 'exam1';
  if (n.includes('اختبار') && n.includes('الثاني')) return 'exam2';
  if (n.includes('مشروع'))          return 'project';
  if (n.includes('ارفاق') || n.includes('واجب')) return 'assignment';
  if (n.includes('تدريب'))          return 'practice';
  return 'other';
}

/** يستخرج الدرجة القصوى من اسم العمود */
function extractMaxPoints(name) {
  const m = String(name).match(/\[إجمالي النقاط:\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * يحلّل ملف Blackboard ويعيد بنية موحّدة
 */
export async function parseBlackboardFile(file) {
  const rows = await readFile(file);

  if (!rows.length) throw new Error('الملف فارغ');

  // 1) اكتشاف صف الترويسة
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i].map((c) => String(c || ''));
    if (
      row.some((c) => c.includes('اسم العائلة')) ||
      row.some((c) => c.includes('اسم المستخدم'))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('لم يتم العثور على ترويسة الملف — تأكدي أنه من Blackboard');
  }

  const headerRow = rows[headerIndex].map((c) => String(c || ''));

  // 2) تحليل الأعمدة
  const columns = headerRow.map((name, i) => ({
    index: i,
    fullName: name,
    shortName: name.split('[')[0].trim(),
    type: detectColumnType(name),
    maxPoints: extractMaxPoints(name),
  }));

  const identityCols = {
    family: columns.find((c) => c.fullName.includes('اسم العائلة'))?.index,
    first: columns.find((c) => c.fullName.includes('الاسم الأول'))?.index,
    user: columns.find((c) => c.fullName.includes('اسم المستخدم'))?.index,
    id: columns.find((c) => c.fullName.includes('معرف الطالب'))?.index,
  };

  const scoreColumns = columns.filter(
    (c) => c.type !== 'identity' && c.type !== 'ignore' && c.maxPoints !== null
  );

  // 3) استخراج المتدربات
  const students = rows
    .slice(headerIndex + 1)
    .filter((r) => r && String(r[identityCols.family || 0] || '').trim())
    .map((r) => {
      const family = String(r[identityCols.family] || '').trim();
      const first = String(r[identityCols.first] || '').trim();
      const name = `${first} ${family}`.trim() || first || family;
      const code = String(r[identityCols.user] || r[identityCols.id] || '').trim();

      const scores = {};
      scoreColumns.forEach((col) => {
        const val = String(r[col.index] || '').trim();
        const num = parseFloat(val);
        scores[col.shortName] = isNaN(num) ? 0 : num;
      });

      return { name, code, scores };
    })
    .filter((s) => s.name);

  return {
    students,
    scoreColumns: scoreColumns.map((c) => ({
      name: c.shortName,
      fullName: c.fullName,
      type: c.type,
      maxPoints: c.maxPoints,
    })),
    metadata: {
      totalRows: students.length,
      totalColumns: scoreColumns.length,
      detectedTypes: scoreColumns.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

/** يقترح ربط الأعمدة مع أنواع الاختبارات */
export function suggestColumnMapping(scoreColumns) {
  const mapping = {};

  scoreColumns.forEach((col) => {
    if (col.type === 'exam1') mapping.exam1 = col.name;
    if (col.type === 'exam2') mapping.exam2 = col.name;
    if (col.type === 'assignment') mapping.assignment = col.name;
    if (col.type === 'final') mapping.final = col.name;
    if (col.type === 'total_100') mapping.total = col.name;
    if (col.type === 'total_60') mapping.total60 = col.name;
    if (col.type === 'project') mapping.project = col.name;
  });

  return mapping;
}