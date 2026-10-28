import { useId, type ReactNode } from 'react';
import { Heading } from '../Heading/Heading.tsx';
import { LoadState } from '../LoadState/LoadState.tsx';
import { Text } from '../Text/Text.tsx';

/** What the screen can show: its content, or one of the states every screen has. */
export type ScreenState =
  | { status?: 'ready' }
  | { status: 'loading' }
  | { status: 'empty'; /** One line, for example "No sessions yet." */ emptyText: string }
  | { status: 'error'; /** What happened, then what to do. Defaults to the shared load error. */ errorText?: string; onRetry?: () => void };

export type ScreenProps = ScreenState & {
  /** The screen's heading: a noun such as Balance or Waitlist. */
  title: string;
  /** Controls beside the heading, for example one primary Button. */
  actions?: ReactNode;
  /** 2 for a part of a screen shown under its tabs (#606), such as Devices' Tablets: its heading is the second level. */
  level?: 1 | 2;
  children?: ReactNode;
};

/** One screen of an app: its heading, then its content or its loading, empty or error state. */
export function Screen(props: ScreenProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} aria-busy={props.status === 'loading' || undefined} className="flex flex-col gap-6">
      {/* The heading and its actions wrap onto two lines on a narrow screen. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading level={props.level ?? 1} id={headingId}>
          {props.title}
        </Heading>
        {props.actions}
      </div>
      <ScreenBody {...props} />
    </section>
  );
}

function ScreenBody(props: ScreenProps) {
  switch (props.status) {
    case 'loading':
      return <LoadState />;
    case 'empty':
      return <Text tone="muted">{props.emptyText}</Text>;
    case 'error':
      return <LoadState isError errorText={props.errorText} onRetry={props.onRetry} />;
    default:
      return <>{props.children}</>;
  }
}
