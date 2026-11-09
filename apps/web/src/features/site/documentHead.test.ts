import { describe, expect, it } from 'vitest';
import { documentTitle, localBusiness } from './documentHead.ts';

const MAP = {
  kind: 'map' as const,
  content: { address: 'Upper floor, Glaza, Gurugram', hours: 'Open 14:00 to 08:00.', directionsUrl: 'https://www.google.com/maps/search/?api=1&query=Glaza' },
};
const ORIGIN = 'https://rivrpoker.com';

describe('a page\u2019s document head (8 Nov audit, F-194)', () => {
  it('names the page, the club and the city in its title', () => {
    expect(documentTitle('Visit')).toBe('Visit \u00b7 RIVR Poker Club, Gurugram');
    expect(documentTitle('Page not found')).toBe('Page not found \u00b7 RIVR Poker Club, Gurugram');
  });

  it('does not say the club twice on a page named for it', () => {
    expect(documentTitle('RIVR Poker Club')).toBe('RIVR Poker Club, Gurugram');
  });

  it('describes the club on Visit, from the map band\u2019s address and hours', () => {
    expect(JSON.parse(localBusiness({ slug: 'visit', blocks: [MAP] }, ORIGIN) ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'RIVR Poker Club',
      url: ORIGIN,
      telephone: '+918796580435',
      email: 'info@rivrpoker.com',
      address: { '@type': 'PostalAddress', streetAddress: 'Upper floor, Glaza, Gurugram', addressLocality: 'Gurugram', addressRegion: 'Haryana', addressCountry: 'IN' },
      sameAs: ['https://www.instagram.com/rivr.pokerclub/', 'https://www.youtube.com/@rivr.pokerclub'],
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '14:00',
        closes: '08:00',
      },
    });
  });

  it('describes it on the front page too, and on no other', () => {
    expect(localBusiness({ slug: 'home', blocks: [MAP] }, ORIGIN)).not.toBeNull();
    expect(localBusiness({ slug: 'about', blocks: [MAP] }, ORIGIN)).toBeNull();
  });

  it('says nothing without a map band to take the address from', () => {
    expect(localBusiness({ slug: 'visit', blocks: [] }, ORIGIN)).toBeNull();
  });

  it('leaves the hours out when the club has written them another way', () => {
    const noted = { ...MAP, content: { ...MAP.content, hours: 'Evenings until late.' } };
    expect(JSON.parse(localBusiness({ slug: 'visit', blocks: [noted] }, ORIGIN) ?? '')).not.toHaveProperty('openingHoursSpecification');
  });

  it('cannot close its script, whatever the club writes', () => {
    const written = { ...MAP, content: { ...MAP.content, address: '</script><script>alert(1)</script>' } };
    expect(localBusiness({ slug: 'visit', blocks: [written] }, ORIGIN)).not.toContain('<');
  });
});
