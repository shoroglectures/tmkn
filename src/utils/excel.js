import * as XLSX from 'xlsx';

/** يقرأ ملف Excel/CSV ويعيد مصفوفة صفوف */
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          header: 1,
          defval: '',
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** المتدربات: [الاسم، الرقم، البريد] */
export async function parseStudentsFile(file) {
  const rows = await readFile(file);
  return rows
    .slice(1)
    .filter((r) => String(r[0] || '').trim())
    .map((r) => ({
      name: String(r[0]).trim(),
      code: String(r[1] || '').trim(),
      email: String(r[2] || '').trim(),
    }));
}

/** الأسئلة: [الرقم، النص، المهارة، الموضوع، الإجابة، الدرجة] */
export async function parseQuestionsFile(file) {
  const rows = await readFile(file);
  return rows
    .slice(1)
    .filter((r) => String(r[1] || '').trim())
    .map((r, i) => ({
      number: parseInt(r[0]) || i + 1,
      text: String(r[1]).trim(),
      skill: String(r[2] || 'عام').trim(),
      topic: String(r[3] || '').trim(),
      correct_answer: String(r[4] || '').trim(),
      points: parseInt(r[5]) || 1,
    }));
}

/** الإجابات: صف = متدربة، أعمدة = أسئلة */
export async function parseAnswersFile(file) {
  const rows = await readFile(file);
  return rows; // الصف الأول = ترويسة
}

/** تنزيل مصفوفة كملف Excel */
export function downloadExcel(rows, filename = 'export.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

/** تنزيل قالب Excel للمتدربات */
export function downloadStudentsTemplate() {
  const rows = [
    ['الاسم', 'الرقم', 'البريد الإلكتروني'],
    ['سارة أحمد', 'S1001', 'sara@example.com'],
    ['نور محمد', 'S1002', 'noor@example.com'],
  ];
  downloadExcel(rows, 'قالب-المتدربات.xlsx');
}

/** تنزيل قالب Excel للأسئلة */
export function downloadQuestionsTemplate() {
  const rows = [
    ['الرقم', 'نص السؤال', 'المهارة', 'الموضوع', 'الإجابة الصحيحة', 'الدرجة'],
    [1, 'ما ناتج 2 + 2؟', 'حل المسائل', 'الجبر', 'د', 1],
    [2, 'ما هو الجذر التربيعي لـ 16؟', 'فهم المفاهيم', 'الجبر', 'ب', 1],
  ];
  downloadExcel(rows, 'قالب-الأسئلة.xlsx');
}