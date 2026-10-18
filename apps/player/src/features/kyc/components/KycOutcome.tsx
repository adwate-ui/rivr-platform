import type { KycRecord } from '@rivr/db';
import { KycRefused } from './KycRefused.tsx';
import { KycUnderReview } from './KycUnderReview.tsx';
import { KycVerified } from './KycVerified.tsx';
import { PanStep } from './PanStep.tsx';

/** What a member sees once their check has moved on from DigiLocker. */
export function KycOutcome({ record, onChecked }: { record: KycRecord; onChecked: () => void }) {
  if (record.status === 'verified') return <KycVerified record={record} />;
  if (record.status === 'needs_review') return <KycUnderReview />;
  if (record.status === 'refused') return <KycRefused />;
  return <PanStep knowsDateOfBirth={record.dateOfBirth !== null} onChecked={onChecked} />;
}
