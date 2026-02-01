import { createTheme, MantineProvider } from '@mantine/core'

export const theme = createTheme({
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  headings: { fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' },
  defaultRadius: 'md',
  primaryColor: 'gray',
})

export function ThemeProvider({ children }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {children}
    </MantineProvider>
  )
}
