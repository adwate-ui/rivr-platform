import { Money } from '@rivr/ui';

/** A session's or a month's net, signed: gold when up or even, plain when down, as the prototype colours it. */
export function Net({ paise }: { paise: bigint }) {
  return <Money paise={paise} signed tone={paise >= 0n ? 'player' : 'default'} />;
}
