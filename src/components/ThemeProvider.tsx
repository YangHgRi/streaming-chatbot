// ThemeProvider is an async Server Component from @wrksz/themes/next.
// It uses useServerInsertedHTML to inject the theme-init script outside the
// React component tree, which is the correct fix for the React 19
// "Encountered a script tag" warning that next-themes has not resolved.
export { ThemeProvider } from '@wrksz/themes/next';
export { useTheme } from '@wrksz/themes/client';
