import {describe, expect, it} from 'vitest';
import {withFont} from './type';

describe('withFont', () => {
  it('maps Figma weights to the bundled font files and drops fontWeight', () => {
    expect(withFont({fontSize: 160, fontWeight: '800'})).toEqual({fontSize: 160, fontFamily: 'BricolageGrotesque-ExtraBold'});
    expect(withFont({fontSize: 40, fontWeight: '700'})).toEqual({fontSize: 40, fontFamily: 'Figtree-Bold'});
    expect(withFont({fontSize: 28, fontWeight: '600'})).toEqual({fontSize: 28, fontFamily: 'Figtree-SemiBold'});
    expect(withFont({fontSize: 34, fontWeight: '500'})).toEqual({fontSize: 34, fontFamily: 'Figtree-Medium'});
    expect(withFont({fontSize: 28})).toEqual({fontSize: 28, fontFamily: 'Figtree-Regular'});
  });

  it('draws the display family in Bricolage Grotesque at its two weights', () => {
    expect(withFont({fontSize: 48, fontFamily: 'display', fontWeight: '700'})).toEqual({fontSize: 48, fontFamily: 'BricolageGrotesque-Bold'});
    expect(withFont({fontSize: 48, fontFamily: 'display'})).toEqual({fontSize: 48, fontFamily: 'BricolageGrotesque-ExtraBold'});
  });

  it('leaves styles without text alone, and keeps a real font file name', () => {
    expect(withFont({width: 10})).toEqual({width: 10});
    expect(withFont({fontSize: 20, fontFamily: 'Mono'})).toEqual({fontSize: 20, fontFamily: 'Mono'});
  });
});
