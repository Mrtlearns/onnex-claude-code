import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface PdfOptions {
  filename: string;
  isInternal?: boolean;
}

export async function captureAndDownloadPdf(
  elementRef: HTMLElement | null,
  options: PdfOptions
) {
  if (!elementRef) {
    console.error("PDF export: element ref is null");
    throw new Error("Report element not found");
  }

  // Expand all accordion items before capture
  const accordionItems = elementRef.querySelectorAll('[data-state="closed"]');
  const originalStates: { el: Element; state: string }[] = [];
  accordionItems.forEach((item) => {
    originalStates.push({ el: item, state: item.getAttribute("data-state") || "closed" });
    item.setAttribute("data-state", "open");
    // Also expand the content panel
    const content = item.querySelector('[data-state="closed"]');
    if (content) {
      content.setAttribute("data-state", "open");
      (content as HTMLElement).style.height = "auto";
    }
  });

  // Also directly open any AccordionContent elements
  const contents = elementRef.querySelectorAll('[role="region"][data-state="closed"]');
  contents.forEach((c) => {
    c.setAttribute("data-state", "open");
    (c as HTMLElement).style.height = "auto";
    (c as HTMLElement).style.overflow = "visible";
  });

  // Small delay for DOM to update
  await new Promise((r) => setTimeout(r, 100));

  const canvas = await html2canvas(elementRef, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: "#F8FAFC",
    windowWidth: 1000,
    width: elementRef.scrollWidth,
    height: elementRef.scrollHeight,
  });

  // Restore accordion states
  originalStates.forEach(({ el, state }) => {
    el.setAttribute("data-state", state);
    const content = el.querySelector('[role="region"]');
    if (content) {
      content.setAttribute("data-state", state);
      (content as HTMLElement).style.height = "";
      (content as HTMLElement).style.overflow = "";
    }
  });
  contents.forEach((c) => {
    c.setAttribute("data-state", "closed");
    (c as HTMLElement).style.height = "";
    (c as HTMLElement).style.overflow = "";
  });

  // Use JPEG for smaller file size
  const imgData = canvas.toDataURL("image/jpeg", 0.75);
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pdfWidth - margin * 2;
  const imgRatio = canvas.height / canvas.width;
  const imgHeightMm = contentWidth * imgRatio;
  const pageContentHeight = pdfHeight - margin * 2;

  let yPosition = 0;
  let pageNum = 0;

  while (yPosition < imgHeightMm) {
    if (pageNum > 0) pdf.addPage();

    if (options.isInternal) {
      pdf.setFontSize(8);
      pdf.setTextColor(220, 50, 50);
      pdf.text("INTERNAL \u2014 CONFIDENTIAL", pdfWidth / 2, 6, { align: "center" });
    }

    const topMargin = options.isInternal ? 8 : margin;
    const availableHeight = pdfHeight - topMargin - margin;

    const sourceY = (yPosition / imgHeightMm) * canvas.height;
    const sourceHeight = Math.min(
      (availableHeight / imgHeightMm) * canvas.height,
      canvas.height - sourceY
    );
    const remainingHeight = Math.min(availableHeight, imgHeightMm - yPosition);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = Math.ceil(sourceHeight);
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        canvas,
        0, Math.floor(sourceY), canvas.width, Math.ceil(sourceHeight),
        0, 0, canvas.width, Math.ceil(sourceHeight)
      );
      const pageImgData = tempCanvas.toDataURL("image/jpeg", 0.75);
      pdf.addImage(pageImgData, "JPEG", margin, topMargin, contentWidth, remainingHeight);
    }

    yPosition += availableHeight;
    pageNum++;
    if (pageNum > 40) break;
  }

  pdf.save(options.filename);
}
