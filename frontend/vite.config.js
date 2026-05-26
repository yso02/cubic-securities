import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 💡 여기에 server 설정을 추가했습니다! 기본 브라우저(웨일)로 자동 자동 실행됩니다.
  server: {
    open: true,
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
