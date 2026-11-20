/** A member's History of changes by staff (the owner, 19 Nov), opened from the Members table. `{name}` is the member's. */
export const memberStaffHistory = {
  /** The History button's name for a screen reader; the button is its icon alone. */
  historyOf: 'History of {name}',
  title: 'Changes by staff',
  none: 'No changes by staff.',
  /** What was done and to what, in the Activity screen's words: `Changed · Seat`, `Reset hours · Member`. */
  what: '{action} · {thing}',
  /** Who and when: `Aditya Malhotra · 19 Nov 2026, 21:40`. */
  byline: '{who} · {at}',
  reason: 'Reason: {reason}',
  /** One field: `Status: Needs review → Verified`. */
  change: '{field}: {before} → {after}',
  /** An identity number, document or score, never shown: `PAN changed`. */
  hiddenChange: '{field} changed',
  empty: 'None',
  yes: 'Yes',
  no: 'No',
} as const;

/** Each field a change by staff can touch, by its column, in words. */
const FIELD_WORDS: Readonly<Record<string, string>> = {
  full_name: 'Name', known_as: 'Known as', phone: 'Mobile', tier_id: 'Tier', member_number: 'Member number', referral_code: 'Referral code',
  qualifying_small_blind: 'Qualifying small blind', qualifying_big_blind: 'Qualifying big blind', hours_counted_from: 'Hours counted from', erased_at: 'Erased',
  status: 'Status', method: 'Method', verified_at: 'Verified', refusal: 'Refusal', pan_recheck: 'PAN recheck', pan_rechecked_at: 'PAN rechecked',
  at_club_from: 'At the club from', desk_reason: 'Desk reason', selfie_claimed_at: 'Selfie taken', vendor_failed_at: 'Check failed', vendor_calls: 'Checks run',
  pan: 'PAN', masked_aadhaar: 'Aadhaar', aadhaar_reference: 'Aadhaar reference', aadhaar_name: 'Aadhaar name', date_of_birth: 'Date of birth', address: 'Address',
  photo_path: 'Selfie', path: 'Photo', vendor_reference: 'Check reference', vendor_failure: 'Check failure', entered_pan: 'PAN entered',
  entered_date_of_birth: 'Date of birth entered', identity_key: 'Identity', liveness_score: 'Liveness score', face_match_score: 'Face match score',
  decision: 'Decision', outcome: 'Outcome', kind: 'Kind', taken_at: 'Taken', retake_asked_at: 'Retake asked', retake_reason: 'Retake reason',
  amount_paise: 'Amount', remaining_paise: 'Left', expires_at: 'Expires', expired_at: 'Expired', reversed_at: 'Reversed', reversal_reason: 'Why reversed',
  reversal_paise: 'Amount reversed', used_at: 'Used', trigger: 'Why given', effect: 'Effect', cost_paise: 'Amount', club_day: 'Club day', fulfilled_at: 'Given',
  chips: 'Chips', owed_chips: 'Chips owed', perk: 'Perk', points: 'Points', table_name: 'Table', table_id: 'Table', reason: 'Reason',
  opened_at: 'Checked in', closed_at: 'Checked out', close_reason: 'Why closed', bonus_at_first_seat_paise: 'Bonus at first use',
  seat: 'Seat', started_at: 'Seated', seated_here_at: 'Seated here', ended_at: 'Left', end_reason: 'Why left', leave_reason: 'Why left',
  away_since: 'Away since', away_seconds: 'Time away', call_time_minutes: 'Call time', call_time_completed_at: 'Call time met', call_time_first_met_at: 'Call time first met',
  call_time_set_at: 'Call time set', reminded_at: 'Reminded', leaving_at: 'Leaving', top_up_requested_at: 'Top-up asked', top_up_started_at: 'Top-up started',
  ending_warned_at: 'Warned', table_type_id: 'Game', joined_at: 'Joined', left_at: 'Left', called_at: 'Called', hold_until: 'Held until', call_table_id: 'Called to',
  call_seat: 'Called to seat', seated_at: 'Seated', stepped_away_at: 'Stepped away', away_used: 'Time away used', left_reason: 'Why left', approved_at: 'Approved',
  on_way_at: 'On the way', shortfall_seconds: 'Short by', step_number: 'Step', from_tier_id: 'From tier', to_tier_id: 'To tier', ends_at: 'Ends', starts_at: 'Starts',
  is_expiry: 'Expired', feature_key: 'Feature', is_granted: 'Given', revoked_at: 'Revoked', lift_reason: 'Why lifted', session_reminder_hours: 'Session reminder',
  level: 'Level', feature: 'Feature', engaged_at: 'Frozen', released_at: 'Released', release_reason: 'Why released', purpose: 'Purpose', granted_at: 'Given',
  withdrawn_at: 'Withdrawn', code: 'Code', completed_at: 'Completed',
};

/** A field of a change by staff in words; null for one with none, which History leaves out rather than show a column's name. */
export function staffHistoryFieldWord(field: string): string | null {
  return FIELD_WORDS[field] ?? null;
}
