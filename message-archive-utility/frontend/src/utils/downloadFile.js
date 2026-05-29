export async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Download failed");
  }

  const blob = await response.blob();
  const filename = getDownloadFilename(response.headers.get("Content-Disposition")) || getFallbackFilename(url);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return filename;
}

function getDownloadFilename(contentDisposition) {
  if (!contentDisposition) return "";
  const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (filenameStarMatch) {
    try {
      return decodeURIComponent(filenameStarMatch[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return filenameStarMatch[1].trim().replace(/^"|"$/g, "");
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch ? filenameMatch[1].trim() : "";
}

function getFallbackFilename(url) {
  const path = String(url || "").split("?")[0];
  const name = path.split("/").filter(Boolean).pop();
  return name || "message-archive-export";
}
