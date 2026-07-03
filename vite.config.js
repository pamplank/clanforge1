import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // WSL2 + /mnt/c (DrvFs) don't reliably deliver native filesystem-change
    // events to chokidar, so the dev server can silently keep serving stale
    // content after an edit. Polling trades a bit of CPU for actually
    // noticing changes on this filesystem.
    watch: {
      usePolling: true,
    },
    // Without this, Vite binds only to 127.0.0.1 inside the WSL2 VM.
    // WSL2's localhost-forwarding to Windows usually still reaches that,
    // but it's known to intermittently drop (VM network state changes,
    // sleep/resume, etc.), making the dev server "unreachable" from the
    // Windows browser even though it's healthy inside WSL2. Binding to
    // all interfaces removes that dependency on localhost-forwarding
    // working correctly.
    host: true,
  },
})