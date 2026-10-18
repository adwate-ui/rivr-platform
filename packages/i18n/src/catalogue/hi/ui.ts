import type { ui as en } from '../en/ui.ts';
import type { Messages } from '../types.ts';

export const ui: Messages<typeof en> = {
  brand: {
    name: 'RIVR',
    tagline: 'पोकर क्लब',
    label: 'RIVR पोकर क्लब',
  },
  playerTabs: {
    label: 'मुख्य',
    home: 'होम',
    sessions: 'सेशन',
    balance: 'बैलेंस',
    rewards: 'रिवॉर्ड',
    learn: 'सीखें',
  },
  profile: {
    open: 'प्रोफ़ाइल',
  },
  consoleRail: {
    label: 'सेक्शन',
    groups: {
      floor: 'फ़्लोर',
      money: 'पैसा',
      players: 'खिलाड़ी',
      growth: 'ग्रोथ',
      team: 'टीम',
      reports: 'रिपोर्ट',
    },
    items: {
      liveFloor: 'लाइव फ़्लोर',
      waitlist: 'वेटलिस्ट',
      checkIn: 'चेक-इन',
      tournaments: 'टूर्नामेंट',
      cage: 'केज',
      markers: 'मार्कर',
      treasury: 'ट्रेज़री',
      endOfDay: 'दिन का हिसाब',
      members: 'सदस्य',
      kycReview: 'KYC जाँच',
      hostQueue: 'होस्ट कतार',
      promotions: 'प्रमोशन',
      jackpots: 'जैकपॉट',
      rewards: 'रिवॉर्ड',
      academy: 'अकादमी',
      staff: 'स्टाफ़',
      dealers: 'डीलर',
      sops: 'SOP',
      reports: 'रिपोर्ट',
    },
  },
  web: {
    navigation: 'साइट',
  },
  killSwitch: {
    member: 'क्लब अभी रुका हुआ है। स्टाफ आपकी सहायता करेगा।',
    staff: 'वेन्यू फ़्रीज़ है। रिलीज़ होने तक पैसे, सीटिंग और हैंड की एंट्री नहीं होगी।',
  },
};
