import type * as en from '../en/apps.ts';
import type { Messages } from '../types.ts';

export const playerApp: Messages<typeof en.playerApp> = {
  tonight: { title: 'आज रात', empty: 'कोई टेबल नहीं चल रही है।' },
  sessions: { title: 'सेशन', empty: 'अभी कोई सेशन नहीं।' },
  balance: { title: 'बैलेंस', empty: 'अभी कोई लेन-देन नहीं।' },
  rewards: { title: 'रिवॉर्ड', empty: 'अभी कोई रिवॉर्ड नहीं।' },
  learn: { title: 'सीखें', empty: 'अभी कोई स्रोत नहीं।' },
  profile: { title: 'प्रोफ़ाइल', empty: 'अपनी प्रोफ़ाइल देखने के लिए साइन इन करें।' },
};

export const consoleApp: Messages<typeof en.consoleApp> = {
  liveFloor: { title: 'लाइव फ़्लोर', empty: 'कोई टेबल नहीं चल रही है।' },
};

export const tabletApp: Messages<typeof en.tabletApp> = {
  unassignedTable: 'असाइन नहीं',
  handEntry: { title: 'हैंड एंट्री', empty: 'यह टैबलेट किसी टेबल से जुड़ा नहीं है।' },
};

export const displayApp: Messages<typeof en.displayApp> = {
  unpaired: 'यह स्क्रीन जुड़ी नहीं है।',
};

export const driverApp: Messages<typeof en.driverApp> = {
  pickups: { title: 'पिकअप', empty: 'कोई पिकअप नहीं।' },
};

export const webApp: Messages<typeof en.webApp> = {
  opening: 'रविवार 15 नवंबर को खुल रहा है।',
};
