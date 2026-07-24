import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  esbuild: {
    // 本番ビルドでは console.* / debugger を除去する（開発時は残す）。
    // 予約フォーム等に多数残るデバッグログに個人情報が含まれるため、本番バンドルには出さない。
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}))
