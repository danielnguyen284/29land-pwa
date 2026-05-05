import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth";
import axios from "axios";

const router = Router();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "7d2dc77b71b5361281861f96afbcd67e";

router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ message: "Image base64 data is required" });
    }

    // Strip prefix like data:image/png;base64,
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const formData = new URLSearchParams();
    formData.append("image", base64Data);

    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    if (response.data && response.data.data && response.data.data.url) {
      return res.json({ url: response.data.data.url });
    } else {
      return res.status(500).json({ message: "Failed to upload to ImgBB", details: response.data });
    }
  } catch (error) {
    console.error("ImgBB Upload Error:", error);
    return res.status(500).json({ message: "Internal server error during upload" });
  }
});

export default router;
