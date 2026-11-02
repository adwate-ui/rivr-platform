import { t } from '@rivr/i18n';
import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { Heading } from '../Heading/Heading.tsx';
import { LoadState } from '../LoadState/LoadState.tsx';
import { Skeleton } from '../Skeleton/Skeleton.tsx';
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
  /** `serif`, the player redesign's screen title in the display face at 36 (decision 0320). */
  titleLook?: 'default' | 'serif';
  /** Keeps the heading for screen readers only: a screen headed by something else, such as Tonight's wordmark. */
  isTitleHidden?: boolean;
  /** `skeleton`, faint blocks in place of the word, for the player app's first load (decision 0320). */
  loadingLook?: 'text' | 'skeleton';
  children?: ReactNode;
};

const TitleCountContext = createContext(0);

export interface TitleCountProps {
  /** How many urgent items wait for this staff member; none below 1. */
  count: number;
  children: ReactNode;
}

/** Every screen inside starts the page's name with `count` when there is one, "(3) Top-ups · RIVR" (decision 0301). */
export function TitleCount({ count, children }: TitleCountProps) {
  return <TitleCountContext.Provider value={count}>{children}</TitleCountContext.Provider>;
}

/**
 * A screen of its own (an h1, not one nested at level 2) names the page, "Check-in · RIVR", and takes the focus when it
 * opens, so a keyboard or screen reader starts at its heading rather than on the last screen's link (F5-03). A field the
 * screen focuses itself, such as the door's scanner field, keeps the focus.
 */
function useScreenFocus(title: string, headingId: string, isOwnScreen: boolean) {
  const section = useRef<HTMLElement>(null);
  const count = useContext(TitleCountContext);
  useEffect(() => {
    if (!isOwnScreen) return undefined;
    // The title before it is the page's again when the screen goes, as for the sign-in steps, which are no screen.
    const before = document.title;
    document.title = count > 0 ? t('ui.screenTitleCounted', { count, title }) : t('ui.screenTitle', { title });
    return () => {
      document.title = before;
    };
  }, [isOwnScreen, title, count]);
  useEffect(() => {
    const element = section.current;
    if (!isOwnScreen || element === null || element.contains(document.activeElement)) return;
    document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [isOwnScreen, headingId]);
  return section;
}

const SERIF_TITLE = { variant: 'serif' } as const;

/** One screen of an app: its heading, then its content or its loading, empty or error state. */
export function Screen(props: ScreenProps) {
  const headingId = useId();
  const isOwnScreen = (props.level ?? 1) === 1;
  const section = useScreenFocus(props.title, headingId, isOwnScreen);
  return (
    <section ref={section} aria-labelledby={headingId} aria-busy={props.status === 'loading' || undefined} className="flex flex-col gap-6">
      {/* The heading and its actions wrap onto two lines on a narrow screen; a hidden heading takes no room at all. */}
      {props.isTitleHidden === true ? (
        <Heading level={props.level ?? 1} id={headingId} isFocusTarget={isOwnScreen} isVisuallyHidden>{props.title}</Heading>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Heading level={props.level ?? 1} id={headingId} isFocusTarget={isOwnScreen} {...(props.titleLook === 'serif' ? SERIF_TITLE : {})}>
            {props.title}
          </Heading>
          {props.actions}
        </div>
      )}
      <ScreenBody {...props} />
    </section>
  );
}

function ScreenBody(props: ScreenProps) {
  switch (props.status) {
    case 'loading':
      return props.loadingLook === 'skeleton' ? <Skeleton /> : <LoadState />;
    case 'empty':
      return <Text tone="muted">{props.emptyText}</Text>;
    case 'error':
      return <LoadState isError errorText={props.errorText} onRetry={props.onRetry} />;
    default:
      return <>{props.children}</>;
  }
}
