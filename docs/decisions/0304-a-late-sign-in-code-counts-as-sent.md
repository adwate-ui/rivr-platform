# 0304: A late sign-in code counts as sent

Date: 3 Nov 2026. Settled by the owner on 3 Nov, after the first real-number sign-ins on staging.

- **What happened.** Auth gives the Send SMS hook 5 seconds, and `sendSignInCode` keeps every send within 4.5 seconds. Through the Evolution bridge (decision 0297), a send takes 4 seconds or more: a Tailscale Funnel hop, plus a cache held on Upstash. The bridge delivered each code after the function had given up. So the owner got four codes and four errors, and the app never showed the code screen.
- **The rule.** The last channel to try, if it is still sending at the deadline, counts as sent. Auth gets its 200 and the app asks for the code. A channel that fails within its time is still reported, as before. A silent WhatsApp still gives way to SMS while SMS is left to try.
- **The request finishes.** The function hands each late send to `EdgeRuntime.waitUntil`, and the bridge request may run for up to 15 seconds after the reply.
- **What it costs.** A slow failure now looks like a sent code that never arrives. The member asks again. That second code within ten minutes goes by SMS first (#181), once MSG91 is set; until then it goes by WhatsApp again.
- **Not chosen.** Speeding up the bridge (local Redis, another tunnel) is shared with poker-settle, and would still not fit reliably under 4 seconds.
