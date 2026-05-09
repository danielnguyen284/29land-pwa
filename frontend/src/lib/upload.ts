import { apiFetch } from "./api";

/**
 * Standard utility to upload multiple files to the backend
 * Encodes files to base64 and posts to /api/upload
 */
export async function uploadFiles(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  
  for (const file of files) {
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    try {
      const res = await apiFetch<{url: string}>("/api/upload", {
        method: "POST",
        body: JSON.stringify({ image: base64 })
      });
      urls.push(res.url);
    } catch (err) {
      console.error("Upload error for file:", file.name, err);
      throw err;
    }
  }
  
  return urls;
}
