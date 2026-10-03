# setup-1.ps1 — إنشاء ملفات الإعدادات الأساسية
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function W($path, $content) {
  $dir = Split-Path $path -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, $utf8)
  Write-Host "  ✅ $path" -ForegroundColor Green
}

Write-Host "`n📦 السكربت 1: الإعدادات...`n" -ForegroundColor Cyan

W "vite.config.js" @'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
'@

W "tailwind.config.js" @'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#e6f0ed',100:'#b3d1c6',200:'#80b3a0',300:'#4d947a',
          400:'#33997a',500:'#00a86b',600:'#006747',700:'#00563b',
          800:'#00452f',900:'#003423',
        },
        gold: { 400:'#fbbf24', 500:'#f59e0b', 600:'#d97706' },
      },
      fontFamily: { sans: ['Tajawal', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
'@

W "postcss.config.js" @'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
'@

W ".env" @'
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
'@

W "public\logo.svg" @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#006747"/>
  <path d="M20 34 L28 42 L46 22" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="46" cy="18" r="6" fill="#00a86b"/>
</svg>
'@

Write-Host "`n🎉 السكربت 1 انتهى`n" -ForegroundColor Cyan