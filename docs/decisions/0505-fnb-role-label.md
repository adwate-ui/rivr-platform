# 0505: The Service role is F&B

Date: 8 Nov 2026 · The owner's request of 8 Nov ("a role with just F&B access") and answer ("chime only")

**Why.** The owner asked for a role with F&B access alone, told of new orders, able to move them on and set the menu. The `service` role already is that. It holds `fnb.serve` (with `incidents.log` and `sops.acknowledge`), lands on F&B, and hears the console's chime with the tab-title count. It saves and imports the menu, and accepts, sends and delivers orders.

**What.** Only its name changes: the console calls it "F&B" (`staff.roles.service`, `sops.roleNames.service`). The enum value stays `service`. Renaming it would touch the role matrix, its parity test and the pgTAP tests for nothing anyone sees. No WhatsApp or push (the owner's choice).
