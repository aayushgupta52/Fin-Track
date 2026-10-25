import { create } from 'zustand';

const STORAGE_KEY = 'fintrack-theme';

// Read the saved theme, falling back to the OS preference.
const initialTheme = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Toggles the `dark` class on <html>, which Tailwind's class strategy keys off.
const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const useThemeStore = create((set, get) => ({
  theme: initialTheme(),

  apply: () => applyTheme(get().theme),

  toggle: () =>
    set((state) => {
      const theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(theme);
      return { theme };
    }),
}));
