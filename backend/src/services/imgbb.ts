import dotenv from "dotenv";
dotenv.config();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "";

export async function uploadToImgBB(base64Image: string): Promise<string> {
  if (!IMGBB_API_KEY) {
    throw new Error("IMGBB_API_KEY is not configured");
  }

  const formData = new URLSearchParams();
  formData.append("key", IMGBB_API_KEY);
  formData.append("image", base64Image);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`ImgBB upload failed: ${res.status}`);
  }

  const data = (await res.json()) as { data: { url: string } };
  return data.data.url;
}
