import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        college: {
          primary: '#FFFFFF',
          secondary: '#C06121',
          accent: '#703C19',
          text: '#202020',
          bg: '#FFF4EC',
          surface: '#FFFFFF',
          peach: '#FFEBDD',
          'secondary-dark': '#A0511A',
          'accent-dark': '#502A10',
        }
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
