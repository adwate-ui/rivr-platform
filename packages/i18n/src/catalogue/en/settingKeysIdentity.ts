/** The settings on who may join and sign in, as staff read them: see settingKeys.ts. */
export const identitySettingKeys = {
  'kyc.minimum_age': {
    name: 'Minimum age',
    help: 'The age a member must have reached to be verified and to play. Never below 18.',
    fields: { years: 'Age' },
  },
  'auth.store_reviewer': {
    name: 'App store reviewer number',
    help: 'The one number the app stores\' reviewers sign in with. It signs in only while it is no one who has played.',
    fields: { phone: 'Mobile number' },
  },
  'kyc.at_the_club': {
    name: 'Identity (KYC) checked at the club',
    help: 'Staff check Aadhaar and PAN at the desk',
    fields: { enabled: 'Check KYC at the club' },
  },
};
