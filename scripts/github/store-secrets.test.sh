#!/usr/bin/env bash
# Proves store-secrets.sh keeps every value off command lines and out of its output, and sets nothing when anything is missing.
# gh, pnpm and curl are stand-ins that record their arguments.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SENTINEL="SENTINELVALUE"
CODE="987654"
STORE="$WORK/store"
BIN="$WORK/bin"
mkdir -p "$STORE" "$BIN"

printf 'keystore-%s' "$SENTINEL" > "$STORE/android-upload.keystore"
printf 'ANDROID_KEYSTORE_PASSWORD=p-%s\nANDROID_KEY_ALIAS=a-%s\nANDROID_KEY_PASSWORD=k-%s\n' "$SENTINEL" "$SENTINEL" "$SENTINEL" > "$STORE/android.env"
printf '{"project_id":"%s"}' "$SENTINEL" > "$STORE/play-service-account.json"
printf '{"project_info":"%s"}' "$SENTINEL" > "$STORE/google-services.json"
printf 'ASC_KEY_ID=i-%s\nASC_ISSUER_ID=s-%s\nAPPLE_TEAM_ID=t-%s\n' "$SENTINEL" "$SENTINEL" "$SENTINEL" > "$STORE/asc.env"
printf 'pem-%s\nline-two\n' "$SENTINEL" > "$STORE/asc-key.p8"
printf 'APNS_KEY_ID=k-%s\nAPNS_TEAM_ID=t-%s\n' "$SENTINEL" "$SENTINEL" > "$STORE/apns.env"
printf 'pem-%s\nline-two\n' "$SENTINEL" > "$STORE/apns-key.p8"
printf '{"private_key":"%s"}' "$SENTINEL" > "$STORE/fcm-service-account.json"
printf 'STORE_REVIEWER_NUMBER=+919000000999\nSTORE_REVIEWER_CODE=%s\n' "$CODE" > "$STORE/reviewer.env"

cat > "$BIN/gh" <<'STUB'
#!/usr/bin/env bash
echo "gh $*" >> "$LOG"
if [ "$1 $2" = "secret list" ]; then
  printf '%s\n' ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD PLAY_SERVICE_ACCOUNT_JSON PLAYER_GOOGLE_SERVICES_JSON_BASE64 ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_P8 APPLE_TEAM_ID STORE_REVIEWER_NUMBER
else
  cat >> "$STDIN_LOG"
fi
STUB
cat > "$BIN/pnpm" <<'STUB'
#!/usr/bin/env bash
echo "pnpm $*" >> "$LOG"
if [[ "$*" == *"secrets list"* ]]; then printf 'APNS_TEAM_ID APNS_KEY_ID APNS_PRIVATE_KEY APNS_ENVIRONMENT FCM_SERVICE_ACCOUNT\n'; fi
STUB
cat > "$BIN/curl" <<'STUB'
#!/usr/bin/env bash
echo "curl $*" >> "$LOG"
body="$(cat)"
printf '%s\n' "$body" >> "$STDIN_LOG"
if [[ "$body" == *"as held"* ]]; then printf '[{"held": %s}]' "${HELD:-false}"; else printf '{}'; fi
STUB
chmod +x "$BIN/gh" "$BIN/pnpm" "$BIN/curl"

export PATH="$BIN:$PATH" RIVR_STORE_SECRETS="$STORE" SUPABASE_ACCESS_TOKEN="$SENTINEL" SUPABASE_PROD_REF=projectref LOG="$WORK/argv" STDIN_LOG="$WORK/stdin"
: > "$LOG"
: > "$STDIN_LOG"

fail() { echo "FAIL: $1" >&2; exit 1; }

"$HERE/store-secrets.sh" --check > "$WORK/check.out"
grep -q 'present  asc-key.p8' "$WORK/check.out" || fail "--check lists the files"
grep -q "$SENTINEL" "$WORK/check.out" && fail "--check printed a value"
grep -Eq 'secret set|curl|pnpm' "$LOG" && fail "--check changed something"

"$HERE/store-secrets.sh" > "$WORK/run.out" 2>&1
grep -q "$SENTINEL" "$WORK/run.out" && fail "a value reached the output"
grep -q "$SENTINEL" "$LOG" && fail "a value reached a command line"
grep -q "$CODE" "$WORK/run.out" && fail "the fixed code reached the output"
grep -q "$CODE" "$LOG" && fail "the fixed code reached a command line"
grep -q "$CODE" "$STDIN_LOG" || fail "the fixed code did not reach stdin"
grep -q "$SENTINEL" "$STDIN_LOG" || fail "the values did not reach stdin"
grep -q 'every secret is listed by name' "$WORK/run.out" || fail "it did not confirm the names"
first_setting="$(grep -n 'auth.store_reviewer' "$STDIN_LOG" | head -1 | cut -d: -f1)"
first_code="$(grep -n 'sms_test_otp' "$STDIN_LOG" | head -1 | cut -d: -f1)"
[ "$first_setting" -lt "$first_code" ] || fail "the fence must be set before the fixed code"

: > "$LOG"
: > "$STDIN_LOG"
if HELD=true "$HERE/store-secrets.sh" > "$WORK/held.out" 2>&1; then fail "it set a number held by someone real"; fi
grep -q "$SENTINEL" "$WORK/held.out" && fail "a refusal printed a value"
grep -q 'gh secret set' "$LOG" && fail "it set secrets after refusing the number"
grep -q 'auth.store_reviewer.*now()' "$STDIN_LOG" && grep -q 'insert into public.setting' "$STDIN_LOG" && fail "it set the fence after refusing the number"
grep -q 'config/auth' "$LOG" && fail "it set the fixed code after refusing the number"

printf 'STORE_REVIEWER_NUMBER=+919000000999\nSTORE_REVIEWER_CODE=123456\n' > "$STORE/reviewer.env"
: > "$LOG"
if "$HERE/store-secrets.sh" > "$WORK/seed.out" 2>&1; then fail "it took the seed's code"; fi
grep -q "must not be the seed's" "$WORK/seed.out" || fail "it did not say why the code was refused"
printf 'STORE_REVIEWER_NUMBER=+919000000999\nSTORE_REVIEWER_CODE=%s\n' "$CODE" > "$STORE/reviewer.env"

printf 'not json' > "$STORE/fcm-service-account.json"
if "$HERE/store-secrets.sh" > "$WORK/json.out" 2>&1; then fail "it took a malformed file"; fi
grep -q 'fcm-service-account.json is not valid JSON' "$WORK/json.out" || fail "it did not name the malformed file"
printf '{"private_key":"%s"}' "$SENTINEL" > "$STORE/fcm-service-account.json"

: > "$LOG"
rm "$STORE/apns-key.p8"
if "$HERE/store-secrets.sh" > "$WORK/missing.out" 2>&1; then fail "it ran with a file missing"; fi
grep -q 'MISSING  apns-key.p8' "$WORK/missing.out" || fail "it did not name the missing file"
grep -q 'Nothing was set' "$WORK/missing.out" || fail "it did not say nothing was set"
grep -Eq 'secret set|curl|pnpm' "$LOG" && fail "it changed something with a file missing"

echo "store-secrets.sh: every check passed"
