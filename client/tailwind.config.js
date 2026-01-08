/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'display': ['"Bebas Neue"', 'sans-serif'],
        'sans': ['"Bebas Neue"', 'sans-serif'],
      },
      colors: {
        // New dark theme palette
        dark: '#222831',      // Main background
        card: '#393e46',      // Cards, secondary backgrounds
        accent: '#00adb5',    // Teal - primary accent
        light: '#eeeeee',     // Off-white text
        // Keep semantic colors for now (may adjust later)
        primary: '#222831',
        secondary: '#393e46',
        highlight: '#00adb5',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}
