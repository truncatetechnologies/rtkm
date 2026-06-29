// Extract plain text from a PDF buffer using pdf-parse.
export async function extractText(buffer) {
  // Import the lib directly (avoids pdf-parse index.js debug-mode file read).
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (e) {
    return "";
  }
}
