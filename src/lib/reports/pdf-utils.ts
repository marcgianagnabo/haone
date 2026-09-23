/**
 * Converts an image URL to a base64 data URL.
 * Returns "" (not a broken data URL) when the source is missing or not an image,
 * so downstream PDF generation never receives an invalid image entry.
 */
export async function imgToDataUrl(url: string): Promise<string> {
  if (!url) {
    return "";
  }
  try {
    if (/^data:/i.test(url)) {
      return url;
    }
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch image for PDF:", url, response.status);
      return "";
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      console.error("Fetch URL did not resolve to an image:", url, blob.type);
      return "";
    }
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to fetch image for PDF:", e);
    return "";
  }
}

/**
 * Triggers a browser download of a pdfMake document definition.
 * Uses a blob + anchor element instead of pdfmake's `window.open` so the
 * download is not blocked by popup blockers after async work.
 */
export async function downloadPdf(
  pdfMake: any,
  docDefinition: import("pdfmake/interfaces").TDocumentDefinitions,
  filename: string
): Promise<void> {
  const blob = await pdfMake.createPdf(docDefinition).getBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Loads pdfMake and registers custom fonts dynamically.
 */
export async function getPdfMake() {
  const [pdfMakeMod, pdfFontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);

  const pdfMake = pdfMakeMod.default;
  const pdfFonts = pdfFontsMod.default;

  const vfs = (pdfFonts as any).pdfMake
    ? (pdfFonts as any).pdfMake.vfs
    : (pdfFonts as any).vfs || pdfFonts;
  (pdfMake as any).vfs = vfs;

  const fontBase = "https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/ttf";
  (pdfMake as any).addFonts({
    Archivo: {
      normal: `${fontBase}/Archivo-Regular.ttf`,
      bold: `${fontBase}/Archivo-SemiBold.ttf`,
      italics: `${fontBase}/Archivo-Italic.ttf`,
      bolditalics: `${fontBase}/Archivo-SemiBoldItalic.ttf`
    },
    Roboto: {
      normal: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Regular.ttf",
      bold: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Medium.ttf",
      italics: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Italic.ttf",
      bolditalics: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-MediumItalic.ttf"
    }
  });

  return pdfMake;
}
