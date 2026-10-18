import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The signed-in member as the player app shows them. */
export interface Member {
  readonly id: string;
  readonly fullName: string;
  /** The capital letter the shell shows top right: `A` for Asha Verma. */
  readonly initial: string;
}

/**
 * The signed-in member, or null for staff and the public. A login with no member yet links once
 * and asks again: the app may have closed between checking the code and linking it.
 */
export function useMember() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.member(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Member | null> => {
      const read = () => client.from('member').select('id, full_name').eq('user_id', userId ?? '').maybeSingle();
      let answer = await read();
      if (!answer.error && answer.data === null) {
        await client.rpc('link_my_login');
        answer = await read();
      }
      if (answer.error) throw answer.error;
      if (answer.data === null) return null;
      const fullName = answer.data.full_name;
      return { id: answer.data.id, fullName, initial: fullName.trim().charAt(0).toUpperCase() };
    },
  });
}
