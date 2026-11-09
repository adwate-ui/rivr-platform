#!/usr/bin/env bash
# Sets the store launch's secrets from the files the owner puts in ~/rivr-secrets/store/ (docs/runbooks/store-listing.md).
# Every value goes by stdin or a private temporary file, never on a command line and never in the output. From the repository root:
#   scripts/github/store-secrets.sh --check   says which files and keys are there, and changes nothing
#   scripts/github/store-secrets.sh           sets everything, or nothing if anything is missing
# Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROD_REF in the environment.
set -euo pipefail

STORE="${RIVR_STORE_SECRETS:-$HOME/rivr-secrets/store}"
REPO="${RIVR_REPO:-adwate-ui/rivr-platform}"
API="https://api.supabase.com/v1/projects"

FILES=(android-upload.keystore android.env play-service-account.json google-services.json asc.env asc-key.p8 apns.env apns-key.p8 fcm-service-account.json reviewer.env)
KEYS=(android.env:ANDROID_KEYSTORE_PASSWORD android.env:ANDROID_KEY_ALIAS android.env:ANDROID_KEY_PASSWORD
  asc.env:ASC_KEY_ID asc.env:ASC_ISSUER_ID asc.env:APPLE_TEAM_ID
  apns.env:APNS_KEY_ID apns.env:APNS_TEAM_ID
  reviewer.env:STORE_REVIEWER_NUMBER reviewer.env:STORE_REVIEWER_CODE)
# The GitHub secrets the release reads, in the production environment.
GITHUB_NAMES=(ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD PLAY_SERVICE_ACCOUNT_JSON
  PLAYER_GOOGLE_SERVICES_JSON_BASE64 ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_P8 APPLE_TEAM_ID STORE_REVIEWER_NUMBER)
FUNCTION_NAMES=(APNS_TEAM_ID APNS_KEY_ID APNS_PRIVATE_KEY APNS_ENVIRONMENT FCM_SERVICE_ACCOUNT)

value_of() { sed -n "s/^$2=//p" "$STORE/$1" | head -1 | tr -d '\r\n'; }

# Says what is missing, by name only; true when nothing is.
check() {
  local missing=0 entry
  for entry in "${FILES[@]}"; do
    if [ -s "$STORE/$entry" ]; then echo "present  $entry"; else echo "MISSING  $entry"; missing=1; fi
  done
  for entry in "${KEYS[@]}"; do
    if [ -s "$STORE/${entry%%:*}" ] && [ -n "$(value_of "${entry%%:*}" "${entry##*:}")" ]; then echo "present  ${entry##*:}"; else echo "MISSING  ${entry##*:}"; missing=1; fi
  done
  for entry in SUPABASE_ACCESS_TOKEN SUPABASE_PROD_REF; do
    if [ -n "${!entry:-}" ]; then echo "present  $entry"; else echo "MISSING  $entry (environment)"; missing=1; fi
  done
  gh secret list --env production --repo "$REPO" >/dev/null 2>&1 || { echo "MISSING  gh cannot reach the production environment"; missing=1; }
  if [ "$missing" -eq 0 ]; then
    for entry in play-service-account.json google-services.json fcm-service-account.json; do
      python3 -c 'import json,sys; json.load(sys.stdin)' < "$STORE/$entry" 2>/dev/null || { echo "MISSING  $entry is not valid JSON"; missing=1; }
    done
    value_of reviewer.env STORE_REVIEWER_NUMBER | grep -Eq '^\+91[6-9][0-9]{9}$' || { echo "MISSING  STORE_REVIEWER_NUMBER is not a +91 mobile number"; missing=1; }
    # 123456 is the seed's code, in the repository, so it is no secret.
    value_of reviewer.env STORE_REVIEWER_CODE | grep -Eq '^[0-9]{6}$' || { echo "MISSING  STORE_REVIEWER_CODE is not six digits"; missing=1; }
    [ "$(value_of reviewer.env STORE_REVIEWER_CODE)" != "123456" ] || { echo "MISSING  STORE_REVIEWER_CODE must not be the seed's 123456"; missing=1; }
  fi
  [ "$missing" -eq 0 ]
}

if [ "${1:-}" = "--check" ]; then
  check
  exit
fi
check >/dev/null || { check || true; echo "Nothing was set: put the missing files in $STORE first." >&2; exit 1; }

WORK="$(mktemp -d)"
chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT
HEADERS="$WORK/headers"
printf 'authorization: Bearer %s\ncontent-type: application/json\n' "$SUPABASE_ACCESS_TOKEN" > "$HEADERS"

# The Management API, its body on stdin.
api() { curl -fsS -X "$1" "$API/$SUPABASE_PROD_REF/$2" -H @"$HEADERS" --data-binary @-; }
sql() { python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' | api POST database/query; }

PHONE="$(value_of reviewer.env STORE_REVIEWER_NUMBER)"

# The number must be no one real, or its fixed code would open their account (decision 0575): no staff member, nobody who has
# played, and no member at all unless the setting already names it, as on a re-run after the reviewer has signed up.
held="$(sql <<SQL | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["held"])'
select exists (select 1 from public.staff s where s.phone = '$PHONE')
    or (exists (select 1 from public.member m where m.phone = '$PHONE')
        and not exists (select 1 from public.venue v where not v.is_practice
                        and private.setting_at(v.id, 'auth.store_reviewer', '', now()) ->> 'phone' = '$PHONE'))
    or exists (select 1 from public.member m where m.phone = '$PHONE'
               and (exists (select 1 from public.visit x where x.member_id = m.id)
                    or exists (select 1 from public.tournament_entry x where x.member_id = m.id)
                    or exists (select 1 from public.ledger_entry e join public.ledger_account a on a.id = e.account_id where a.member_id = m.id))) as held
SQL
)"
if [ "$held" != "False" ]; then
  echo "Nothing was set: the reviewer's number is a staff member or someone who has played. Choose another." >&2
  exit 1
fi

# The fence first, so the fixed code is never live without it (decision 0575).
sql >/dev/null <<SQL
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.id, 'auth.store_reviewer', '', jsonb_build_object('phone', '$PHONE'), now(), 'Store review'
from public.venue v where not v.is_practice
SQL
echo "set the reviewer's number as auth.store_reviewer"

# Before the code goes live: with the code listed and this secret unset, the next release would stop halfway.
secret() { gh secret set "$1" --env production --repo "$REPO" >/dev/null; }
printf '%s' "$PHONE" | secret STORE_REVIEWER_NUMBER

python3 -c '
import json, sys, datetime
number, code = sys.stdin.read().split()
until = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
print(json.dumps({"sms_test_otp": number.lstrip("+") + "=" + code, "sms_test_otp_valid_until": until}))
' < <(printf '%s %s\n' "$PHONE" "$(value_of reviewer.env STORE_REVIEWER_CODE)") | api PATCH config/auth >/dev/null
echo "set the reviewer's fixed code in Auth"

base64 -w0 "$STORE/android-upload.keystore" | secret ANDROID_KEYSTORE_BASE64
value_of android.env ANDROID_KEYSTORE_PASSWORD | secret ANDROID_KEYSTORE_PASSWORD
value_of android.env ANDROID_KEY_ALIAS | secret ANDROID_KEY_ALIAS
value_of android.env ANDROID_KEY_PASSWORD | secret ANDROID_KEY_PASSWORD
secret PLAY_SERVICE_ACCOUNT_JSON < "$STORE/play-service-account.json"
base64 -w0 "$STORE/google-services.json" | secret PLAYER_GOOGLE_SERVICES_JSON_BASE64
value_of asc.env ASC_KEY_ID | secret ASC_KEY_ID
value_of asc.env ASC_ISSUER_ID | secret ASC_ISSUER_ID
secret ASC_KEY_P8 < "$STORE/asc-key.p8"
value_of asc.env APPLE_TEAM_ID | secret APPLE_TEAM_ID
echo "set the GitHub secrets"

FUNCTIONS="$WORK/functions.env"
FCM_JSON="$(python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)))' < "$STORE/fcm-service-account.json")"
{
  printf 'APNS_TEAM_ID=%s\n' "$(value_of apns.env APNS_TEAM_ID)"
  printf 'APNS_KEY_ID=%s\n' "$(value_of apns.env APNS_KEY_ID)"
  printf 'APNS_ENVIRONMENT=production\n'
  printf 'APNS_PRIVATE_KEY="%s"\n' "$(awk 'NR>1{printf "\\n"}{printf "%s",$0}' "$STORE/apns-key.p8")"
  printf "FCM_SERVICE_ACCOUNT='%s'\n" "$FCM_JSON"
} > "$FUNCTIONS"
pnpm supabase secrets set --env-file "$FUNCTIONS" --project-ref "$SUPABASE_PROD_REF" >/dev/null
echo "set the Edge Function secrets"

# Confirmed by name only.
listed="$(gh secret list --env production --repo "$REPO" --json name --jq '.[].name')"
for name in "${GITHUB_NAMES[@]}"; do
  grep -qx "$name" <<<"$listed" || { echo "GitHub does not list $name" >&2; exit 1; }
done
listed="$(pnpm -s supabase secrets list --project-ref "$SUPABASE_PROD_REF")"
for name in "${FUNCTION_NAMES[@]}"; do
  grep -q "$name" <<<"$listed" || { echo "Supabase does not list $name" >&2; exit 1; }
done
echo "every secret is listed by name"
