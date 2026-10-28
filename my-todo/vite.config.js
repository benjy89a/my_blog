import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages의 하위 폴더 주소에서도 파일을 찾을 수 있게 상대 경로를 쓴다.
  base: "./",
});
