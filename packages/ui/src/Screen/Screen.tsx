import { t } from '@rivr/i18n';
import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';
import { usePlayerFrame } from '../internal/playerFrame.ts';
import { LoadState } from '../LoadState/LoadState.tsx';
import { PlayerAvatar } from '../PlayerAvatar/PlayerAvatar.tsx';
import { Skeleton } from '../Skeleton/Skeleton.tsx';
import { Text } from '../Text/Text.tsx';

/** What the screen can show: its content, or one of the states every screen has. */
export type ScreenState =
  | { status?: 'ready' }
  | { status: 'loading' }
  | {
    status: 'empty';
    /** One line, for example "No sessions yet." */
    emptyText: string;
    /** The one thing to do about it, on the console (console v3): "Add a table". */
    emptyAction?: { label: string; onClick: () => void } | undefined;
  }
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
  /**
   * `skeleton`, faint blocks in place of the word, for the player app's first load (decision 0320); on the console
   * (console v3), `rows` for a list or table and `tiles` for the live floor.
   */
  loadingLook?: 'text' | 'skeleton' | 'rows' | 'tiles';
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

/** Where the screen sits: its heading's id, whether it is a screen of its own, and the player shell's gutter, if any. */
interface ScreenPlace {
  headingId: string;
  isOwnScreen: boolean;
  /** `px-5` in a player shell that runs edge to edge (Tonight), so a heading or a state keeps the page's gutter. */
  gutter: string | undefined;
  /** A tab screen's own heading in a player shell: the 44 px band of the member's initial, at its end (decision 0380). */
  isTabHeading: boolean;
  /** Its content is not showing yet: it is loading, empty or failed. */
  isWaiting: boolean;
}

/** The screen's own title, read out only when hidden; otherwise a row with its actions and, in a player shell, the initial. */
function ScreenHeading({ props, place }: { props: ScreenProps; place: ScreenPlace }) {
  const heading = { level: props.level ?? 1, id: place.headingId, isFocusTarget: place.isOwnScreen } as const;
  const avatar = place.isTabHeading ? <PlayerAvatar /> : null;
  if (props.isTitleHidden === true) {
    // A screen that heads itself puts the initial in its own header; until its content shows, the initial stands alone.
    return (
      <>
        <Heading {...heading} isVisuallyHidden>{props.title}</Heading>
        {avatar && place.isWaiting ? <div className={cx('flex min-h-touch items-center justify-end', place.gutter)}>{avatar}</div> : null}
      </>
    );
  }
  // The heading and its actions wrap onto two lines on a narrow screen.
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-4', place.isTabHeading && 'min-h-touch', place.gutter)}>
      <Heading {...heading} {...(props.titleLook === 'serif' ? SERIF_TITLE : {})}>{props.title}</Heading>
      {props.actions}
      {avatar}
    </div>
  );
}

/**
 * One screen of an app: its heading, then its content or its loading, empty or error state. In the player app's shell
 * (decision 0380) a screen's heading row is the 44 px band of the member's initial, which sits at its end, centred on the
 * title; and in a shell that runs edge to edge (Tonight) the heading and a loading, empty or error state keep the page's
 * gutter, as only the screen's own content runs to the edges.
 */
export function Screen(props: ScreenProps) {
  const headingId = useId();
  const isOwnScreen = (props.level ?? 1) === 1;
  const section = useScreenFocus(props.title, headingId, isOwnScreen);
  const frame = usePlayerFrame();
  const place: ScreenPlace = {
    headingId, isOwnScreen, gutter: frame?.isFullBleed === true ? 'px-5' : undefined,
    isTabHeading: isOwnScreen && Boolean(frame?.avatar), isWaiting: props.status !== undefined && props.status !== 'ready',
  };
  return (
    <section ref={section} aria-labelledby={headingId} aria-busy={props.status === 'loading' || undefined} className="flex flex-col gap-6">
      <ScreenHeading props={props} place={place} />
      {place.gutter && place.isWaiting ? <div className={place.gutter}><ScreenBody {...props} /></div> : <ScreenBody {...props} />}
    </section>
  );
}

function Loading({ look = 'text' }: { look: ScreenProps['loadingLook'] }) {
  if (look === 'text') return <LoadState />;
  return <Skeleton look={look === 'skeleton' ? 'screen' : look} rows={look === 'rows' ? 6 : 3} />;
}

/** Why there is nothing, in one line, and the one thing to do about it when there is one. */
function Empty({ text, action }: { text: string; action: { label: string; onClick: () => void } | undefined }) {
  if (action === undefined) return <Text tone="muted">{text}</Text>;
  return (
    <div className="flex flex-col items-start gap-3">
      <Text tone="muted">{text}</Text>
      <Button variant="subtle" size="compact" onClick={action.onClick}>{action.label}</Button>
    </div>
  );
}

function ScreenBody(props: ScreenProps) {
  switch (props.status) {
    case 'loading':
      return <Loading look={props.loadingLook} />;
    case 'empty':
      return <Empty text={props.emptyText} action={props.emptyAction} />;
    case 'error':
      return <LoadState isError errorText={props.errorText} onRetry={props.onRetry} />;
    default:
      return <>{props.children}</>;
  }
}
