export async function downloadImage(
  url: string,
  filename = "payment-slip.jpg"
) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("Network response was not ok");

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(blobUrl); // Cleanup
  } catch (error) {
    console.error("Failed to download image:", error);
  }
}
