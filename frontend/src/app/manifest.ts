import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "29LAND Management System",
    short_name: "29LAND",
    description: "Hệ thống quản lý nhà trọ và căn hộ dịch vụ",
    start_url: "/",
    display: "standalone",
    background_color: "#14452F",
    theme_color: "#14452F",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
