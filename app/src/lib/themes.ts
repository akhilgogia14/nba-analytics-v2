// The one theme: dark, with the team's colour as a spotlight on top (see teamTheme.ts).
// Every colour in the app reads from these CSS variables, which are set on the page root.
export const THEME: Record<string, string> = {
  '--bg': '#070A12',
  '--panel': 'rgba(255,255,255,0.045)', '--border': 'rgba(160,190,255,0.16)', '--text': '#EAF0FF', '--muted': '#9FB0CC',
  '--accent': '#5EEAD4', '--track': 'rgba(255,255,255,0.08)', '--whisker': '#5E7BA6', '--band': '#1E6F73',
  '--median': '#5EEAD4', '--dot': '#EAF0FF', '--ring': '#0A0F1C', '--pill': 'rgba(255,255,255,0.05)',
  '--pillText': '#EAF0FF', '--pillBorder': 'rgba(160,190,255,0.28)', '--pillOn': '#5EEAD4', '--pillOnText': '#04141A',
  '--warnBg': 'rgba(250,204,21,0.10)', '--warnBorder': 'rgba(250,204,21,0.45)', '--warnText': '#FDE68A',
  '--inputBg': '#0D1424', '--shadow': '0 0 0 1px rgba(94,234,212,0.05), 0 16px 48px rgba(0,0,0,0.5)',
  '--blur': 'blur(10px)', '--display': 'Sora, Inter, system-ui, sans-serif', '--num': '#F4F8FF',
  '--rowLine': 'rgba(160,190,255,0.10)',
  '--s0b': '#16233A', '--s0t': '#C9D6EE', '--s1b': '#1F4B63', '--s1t': '#EAF0FF',
  '--s2b': '#2FA6A0', '--s2t': '#031A1C', '--s3b': '#5EEAD4', '--s3t': '#031A1C',
}
