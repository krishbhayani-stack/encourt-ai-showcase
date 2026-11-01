#!/usr/bin/env bash
# Voice output for the command deck (constitution rule 3: deterministic, no AI judgment).
# Usage: speak.sh "text"  (or pipe text on stdin)
# Uses ElevenLabs if ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID are set; else macOS `say` (offline, free).
TEXT="${*:-$(cat)}"
[ -z "$TEXT" ] && exit 0
if [ -n "$ELEVENLABS_API_KEY" ] && [ -n "$ELEVENLABS_VOICE_ID" ]; then
  TMP="$(mktemp /tmp/deck-voice-XXXXXX).mp3"
  if curl -sf -X POST "https://api.elevenlabs.io/v1/text-to-speech/$ELEVENLABS_VOICE_ID" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
    -d "{\"text\":$(printf '%s' "$TEXT" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'),\"model_id\":\"eleven_turbo_v2_5\"}" \
    -o "$TMP"; then
    afplay "$TMP"; rm -f "$TMP"; exit 0
  fi
  rm -f "$TMP"
fi
exec say -v "Daniel" -r 172 "$TEXT"
