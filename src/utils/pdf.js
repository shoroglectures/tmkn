import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** يصدّر عنصر HTML كملف PDF */
export async function exportElementAsPDF(element, filename = 'file.pdf') {
  if (!element) throw new Error('العنصر غير موجود');

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20; // هوامش 10مم
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let y = 10;
  let remaining = imgHeight;

  // تقسيم الصفحات إن طالت الصورة
  while (remaining > 0) {
    pdf.addImage(imgData, 'PNG', 10, y - (imgHeight - remaining), imgWidth, imgHeight);
    remaining -= pageHeight - 20;
    if (remaining > 0) pdf.addPage();
  }

  pdf.save(filename);
}

/** يصدّر عناصر تقرير منفصلة إلى صفحات A4 عمودية مع منع تقطيعها بين الصفحات. */
export async function exportElementsAsPDF(elements, filename = 'file.pdf') {
  const pages = elements.filter(Boolean);
  if (!pages.length) throw new Error('لا توجد صفحات للتصدير');

  if (document.fonts?.ready) await document.fonts.ready;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const reportWidth = 794;
  const imageWidth = pageWidth - margin * 2;
  const renderedPages = [];

  for (const element of pages) {
    await Promise.all(Array.from(element.querySelectorAll('img')).map((image) => (
      image.complete ? Promise.resolve() : new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      })
    )));

    const canvas = await html2canvas(element, {
      scale: 1.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: reportWidth,
      windowHeight: element.scrollHeight,
      onclone: (_documentClone, clonedElement) => {
        clonedElement.style.width = `${reportWidth}px`;
        clonedElement.style.minWidth = `${reportWidth}px`;
        clonedElement.style.maxWidth = `${reportWidth}px`;
        clonedElement.style.boxSizing = 'border-box';
      },
    });
    const scale = imageWidth / canvas.width;
    const maxSliceHeight = Math.floor((pageHeight - margin * 2) / scale);

    for (let top = 0; top < canvas.height; top += maxSliceHeight) {
      const sliceHeight = Math.min(maxSliceHeight, canvas.height - top);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      slice.getContext('2d').drawImage(
        canvas,
        0, top, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight
      );
      renderedPages.push({
        image: slice.toDataURL('image/jpeg', 0.86),
        height: sliceHeight * scale,
      });
    }
  }

  renderedPages.forEach((page, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(page.image, 'JPEG', margin, margin, imageWidth, page.height);
  });

  if (!renderedPages.length) {
    throw new Error('تعذر تجهيز صفحات التقرير');
  }

  pdf.save(filename);
}