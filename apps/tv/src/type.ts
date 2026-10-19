// Brand type on the TV (Figma: Foundations). Vega loads fonts from assets/fonts/, named by file:
// a style asks for the file name, not a family plus a weight. Styles keep Figma's terms and
// withFont swaps them for the file that draws them:
//   fontWeight 800, or fontFamily 'display' → Bricolage Grotesque (ExtraBold, or Bold at 700)
//   anything else → Figtree at 400 / 500 / 600 / 700
const DISPLAY: Record<string, string> = {'700': 'BricolageGrotesque-Bold', '800': 'BricolageGrotesque-ExtraBold'};
const BODY: Record<string, string> = {
  '500': 'Figtree-Medium',
  '600': 'Figtree-SemiBold',
  '700': 'Figtree-Bold',
  '800': 'BricolageGrotesque-ExtraBold',
};

export function withFont<T extends Record<string, unknown>>(style: T): T {
  if (style.fontSize === undefined) return style;
  const {fontWeight, fontFamily: family, ...rest} = style;
  if (family !== undefined && family !== 'display' && family !== 'body') return style;
  const weight = String(fontWeight ?? (family === 'display' ? '800' : '400'));
  const file = family === 'display' ? (DISPLAY[weight] ?? DISPLAY['800']!) : (BODY[weight] ?? 'Figtree-Regular');
  return {...rest, fontFamily: file} as unknown as T;
}
