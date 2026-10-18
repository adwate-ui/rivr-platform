import type { common as en } from '../en/common.ts';
import type { Messages } from '../types.ts';

export const common: Messages<typeof en> = {
  loading: 'लोड हो रहा है',
  retry: 'फिर से कोशिश करें',
  loadFailed: 'यह लोड नहीं हो सका। कनेक्शन जाँचें और फिर से कोशिश करें।',
  offline: 'ऑफ़लाइन।',
  close: 'बंद करें',
  cancel: 'रद्द करें',
  confirm: 'पुष्टि करें',
  back: 'वापस',
  notFound: 'यह पेज मौजूद नहीं है।',
  featureLocked: 'केवल {tiers} के लिए।',
};
