/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}", // Quét các file .tsx nằm trực tiếp trong folder frontend
    "./**/*.{js,ts,jsx,tsx}", // Quét tất cả các folder con (pages, layouts, routes, components...)
    "!./node_modules/**", // Bỏ qua folder node_modules để chạy cho nhẹ
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
