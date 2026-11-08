import { t } from '@rivr/i18n';
import { createContext, use, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';
import { ScreenPartContext, useIsInConsole } from '../internal/consoleFrame.ts';
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
  /**
   * Given an element at the end of the title row once it is drawn, for a control a part of the screen draws there: the
   * Members table's Export, beside the title as the prototype has it (`DataTable exportIn`).
   */
  onActionsSlot?: (element: HTMLDivElement | null) => void;
  /** 2 for a part of a screen shown under its tabs (#606), such as Devices' Tablets: its heading is the second level. */
  level?: 1 | 2;
  /** `serif`, the player redesign's screen title in the display face at 36 (decision 0320). */
  titleLook?: 'default' | 'serif';
  /** Keeps the heading for screen readers only: a screen headed by something else, such as Tonight's wordmark. */
  isTitleHidden?: boolean;
  /**
   * The screen's tabs, under its title and above its content (console v3): `Tabs look="pill"`. A Screen inside its content
   * is then one part of it: its title heard as an h2, not shown again, its actions and states as before.
   */
  tabs?: ReactNode;
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

/** Whether the focus is in a menu the person has open, the part its expanded button controls: the console's account menu. */
function isInOpenMenu(element: Element | null): boolean {
  if (element === null) return false;
  return Array.from(document.querySelectorAll('[aria-expanded="true"][aria-controls]'))
    .some((button) => document.getElementById(button.getAttribute('aria-controls') ?? '')?.contains(element) === true);
}

/**
 * A screen of its own (an h1, not one nested at level 2) names the page, "Check-in · RIVR", and takes the focus when it
 * opens, so a keyboard or screen reader starts at its heading rather than on the last screen's link (F5-03). A field the
 * screen focuses itself, such as the door's scanner field, keeps the focus; so does a menu the person has open, as when
 * the practice switch in the account menu loads the screen behind it again.
 */
function useScreenFocus(title: string, headingId: string, isOwnScreen: boolean) {
  const section = useRef<HTMLElement>(null);
  usePageTitle(title, isOwnScreen);
  useEffect(() => {
    const element = section.current;
    if (!isOwnScreen || element === null || element.contains(document.activeElement) || isInOpenMenu(document.activeElement)) return;
    document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [isOwnScreen, headingId]);
  return section;
}

/**
 * Names the page "Order · RIVR" while `isOn` (WCAG 2.4.2), as a Screen of its own does; the title before it is the page's
 * again when it goes. For a step or a detail that draws its own heading rather than a Screen's: the sign-in and identity
 * steps, Order, Profile, a session.
 */
export function usePageTitle(title: string | undefined, isOn = true) {
  const count = useContext(TitleCountContext);
  useEffect(() => {
    if (!isOn || title === undefined || title === '') return undefined;
    const before = document.title;
    document.title = count > 0 ? t('ui.screenTitleCounted', { count, title }) : t('ui.screenTitle', { title });
    return () => {
      document.title = before;
    };
  }, [isOn, title, count]);
}

/**
 * Takes the focus to a heading once `isOn` (its content has loaded), as a Screen of its own does, unless the person is
 * already somewhere on the page: a detail drawn under its own Back button. Give the heading `id` and `isFocusTarget`.
 */
export function useHeadingFocus(headingId: string, isOn = true) {
  useEffect(() => {
    const active = document.activeElement;
    if (!isOn || (active !== null && active !== document.body) || isInOpenMenu(active)) return;
    document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [isOn, headingId]);
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
  /** One tab of a screen that holds others: its title heard, not shown. */
  isPart: boolean;
  /** In the console's shell: below 768 px the header shows the title, so the h1 is heard there, not shown. */
  isInConsole: boolean;
}

type HeadingAttributes = { level: 1 | 2; id: string; isFocusTarget: boolean };

/** The heading's level, id and focus: a part's is an h2 whatever it asked for. */
const headingOf = (props: ScreenProps, place: ScreenPlace): HeadingAttributes =>
  ({ level: place.isPart ? 2 : props.level ?? 1, id: place.headingId, isFocusTarget: place.isOwnScreen });

/** The screen's own title, read out only when hidden; otherwise a row with its actions and, in a player shell, the initial. */
function ScreenHeading({ props, place }: { props: ScreenProps; place: ScreenPlace }) {
  const heading = headingOf(props, place);
  if (place.isPart) return <PartHeading heading={heading} title={props.title} actions={props.actions} />;
  if (props.isTitleHidden === true) return <HiddenTitle heading={heading} title={props.title} place={place} />;
  // On the console's phone the header names the screen: with nothing beside it, the hidden h1 takes no line of its own.
  if (place.isInConsole && props.actions === undefined && props.onActionsSlot === undefined) return <Heading {...heading} isShownFromMedium>{props.title}</Heading>;
  return <TitleRow heading={heading} props={props} place={place} />;
}

/** A screen headed by something else: its title heard; in a player shell the initial alone until its content shows. */
function HiddenTitle({ heading, title, place }: { heading: HeadingAttributes; title: string; place: ScreenPlace }) {
  const isInitialAlone = place.isTabHeading && place.isWaiting;
  return (
    <>
      <Heading {...heading} isVisuallyHidden>{title}</Heading>
      {isInitialAlone ? <div className={cx('flex min-h-touch items-center justify-end', place.gutter)}><PlayerAvatar /></div> : null}
    </>
  );
}

/**
 * An empty element at the title row's end, handed to the part of the screen that draws a control there; at the end on a
 * console phone too, where the title is the header's and the row holds the control alone.
 */
function ActionsSlot({ onSlot }: { onSlot: (element: HTMLDivElement | null) => void }) {
  return <div ref={onSlot} className="ms-auto flex items-center" />;
}

/** The title with its actions, which wrap onto two lines on a narrow screen, and in a player shell the initial at its end. */
function TitleRow({ heading, props, place }: { heading: HeadingAttributes; props: ScreenProps; place: ScreenPlace }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-4', place.isTabHeading && 'min-h-touch', place.gutter)}>
      <Heading {...heading} {...(props.titleLook === 'serif' ? SERIF_TITLE : {})} isShownFromMedium={place.isInConsole}>{props.title}</Heading>
      {props.actions}
      {props.onActionsSlot === undefined ? null : <ActionsSlot onSlot={props.onActionsSlot} />}
      {place.isTabHeading ? <PlayerAvatar /> : null}
    </div>
  );
}

/** A tab's own screen inside another's tabs: its title heard as an h2, its actions at the row's end. */
function PartHeading({ heading, title, actions }: { heading: HeadingAttributes; title: string; actions: ReactNode }) {
  return (
    <>
      <Heading {...heading} isVisuallyHidden>{title}</Heading>
      {actions === undefined ? null : <div className="flex flex-wrap items-center justify-end gap-4">{actions}</div>}
    </>
  );
}

/** Where this screen sits: inside another's tabs, a player shell or the console, and whether its content shows yet. */
function useScreenPlace(props: ScreenProps, headingId: string): ScreenPlace {
  const isPart = use(ScreenPartContext);
  const isInConsole = useIsInConsole();
  const frame = usePlayerFrame();
  const isOwnScreen = !isPart && (props.level ?? 1) === 1;
  return {
    headingId, isOwnScreen, isPart, isInConsole, gutter: frame?.isFullBleed === true ? 'px-5' : undefined,
    isTabHeading: isOwnScreen && Boolean(frame?.avatar), isWaiting: props.status !== undefined && props.status !== 'ready',
  };
}

/**
 * One screen of an app: its heading, then its content or its loading, empty or error state. In the player app's shell
 * (decision 0380) a screen's heading row is the 44 px band of the member's initial, which sits at its end, centred on the
 * title; and in a shell that runs edge to edge (Tonight) the heading and a loading, empty or error state keep the page's
 * gutter, as only the screen's own content runs to the edges. With `tabs`, its title, then the tabs, then its content.
 */
export function Screen(props: ScreenProps) {
  const headingId = useId();
  const place = useScreenPlace(props, headingId);
  const section = useScreenFocus(props.title, headingId, place.isOwnScreen);
  const body = place.gutter && place.isWaiting ? <div className={place.gutter}><ScreenBody {...props} /></div> : <ScreenBody {...props} />;
  return (
    <section ref={section} aria-labelledby={headingId} aria-busy={props.status === 'loading' || undefined} className="flex flex-col gap-6">
      <ScreenHeading props={props} place={place} />
      {props.tabs}
      {/* Under tabs, a screen inside is one part of this one; any deeper is its own again. */}
      <ScreenPartContext value={props.tabs !== undefined}>{body}</ScreenPartContext>
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
      return <LoadState isError errorText={props.errorText} onRetry={props.onRetry} look={props.titleLook} />;
    default:
      return <>{props.children}</>;
  }
}
