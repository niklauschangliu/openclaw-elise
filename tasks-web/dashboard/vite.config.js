import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages you usually need base="/<repo>/".
// We keep it configurable so the same build can be used locally or on Pages.
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base,
})
