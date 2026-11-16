import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' membuat aset dimuat dengan path relatif, sehingga aplikasi
// berjalan benar di GitHub Pages baik sebagai project site (/nama-repo/)
// maupun user site (/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
