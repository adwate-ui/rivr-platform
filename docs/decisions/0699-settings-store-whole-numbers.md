# 0699: Settings store whole numbers whole

Date: 19 Nov 2026. Issue #916.

pg_jsonschema takes `20.0` as an integer. So a setting written straight through the API as `{"minutes": 20.0}` passed its check. Every reader that casts the text (`->>` then `::integer`) then failed on `"20.0"` until a newer row replaced it. A survey found about a hundred such casts in 55 functions; some forty read settings.

The issue proposed changing each reader to cast from jsonb. Instead, the setting is fixed where it is written. `setting_0_whole_numbers`, the first of the setting's insert triggers, stores every whole number whole wherever it sits in the value: `20.0` becomes `20`, and a fraction such as `12.5` stays. Every reader, present or future, then reads what the console writes. Settings are never changed once written, so no stored row needs rewriting.
