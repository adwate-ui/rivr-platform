import { t } from '@rivr/i18n';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface CareersRole {
  readonly title: string;
  /** What the role is and who it suits. */
  readonly body: string;
}

export interface CareersBlockProps {
  heading?: string | undefined;
  roles: readonly CareersRole[];
  /** How to apply, said once under the roles. */
  apply?: string | undefined;
}

/** A website block of open roles, each with its title and a line or two, then how to apply. */
export function CareersBlock({ heading, roles, apply }: CareersBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-6 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      {roles.length === 0 ? <Text tone="muted">{t('ui.web.noOpenings')}</Text> : null}
      {roles.map((role) => (
        <div key={role.title} className="flex max-w-text flex-col gap-2">
          <Heading level={3}>{role.title}</Heading>
          <Text>{role.body}</Text>
        </div>
      ))}
      {apply ? (
        <div className="max-w-text">
          <Text tone="muted">{apply}</Text>
        </div>
      ) : null}
    </section>
  );
}
