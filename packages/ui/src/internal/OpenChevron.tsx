import { Icon } from '../Icon/Icon.tsx';

/**
 * The mark at the end of a `<summary>` (W-10): a chevron down while its `<details>`, marked `group`, is closed, turned up
 * while it is open; at once under reduced motion. FaqBlock's questions, PromotionsBlock's and the cookie banner's Choose.
 */
export function OpenChevron() {
  return <span className="flex shrink-0 motion-safe:transition-transform group-open:rotate-180"><Icon name="chevronDown" size="sm" /></span>;
}
