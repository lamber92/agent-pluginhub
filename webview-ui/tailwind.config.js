/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ide: {
          bg: 'var(--vscode-editor-background, #1e1e1e)',
          fg: 'var(--vscode-editor-foreground, #d4d4d4)',
          sidebar: 'var(--vscode-sideBar-background, #252526)',
          card: 'rgba(30, 30, 30, 0.7)',
          cardBorder: 'var(--vscode-widget-border, rgba(255, 255, 255, 0.1))',
          accent: 'var(--vscode-button-background, #007acc)',
          accentHover: 'var(--vscode-button-hoverBackground, #0062a3)',
          badge: 'var(--vscode-badge-background, #4d4d4d)',
          input: 'var(--vscode-input-background, #3c3c3c)'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
