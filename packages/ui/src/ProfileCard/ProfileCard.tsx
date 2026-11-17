import { Heading } from '../Heading/Heading.tsx';
import { ProfileMark } from '../ProfileMark/ProfileMark.tsx';
import { Text } from '../Text/Text.tsx';

export interface ProfileCardProps {
  /** The member's initial, shown until there is a photo, and while their record loads (empty then). */
  initial: string;
  /** The address of the member's own photo (decision 0588), filling the circle. */
  photo?: string | undefined;
  /** The member's name: the screen's heading. */
  name: string;
  /** The heading's id, for the screen that names itself by it and moves focus to it. */
  headingId: string;
  /** The lines under the name, each one muted: "Founders' Circle · +91 90000 00901", "Member number 1024". */
  details: readonly string[];
}

/**
 * The member at the top of Profile, as one card (the owner, 17 Nov): their photo or initial, their name, and the lines
 * under it, in the gold-edged card the Bonus balance has.
 */
export function ProfileCard({ initial, photo, name, headingId, details }: ProfileCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-gold-edge bg-raised p-5">
      <ProfileMark initial={initial} photo={photo} />
      <div className="flex min-w-0 flex-col gap-1">
        <Heading level={1} variant="serif" serifSize={28} id={headingId} isFocusTarget>{name}</Heading>
        {details.map((line) => <Text key={line} variant="small" tone="muted">{line}</Text>)}
      </div>
    </div>
  );
}
