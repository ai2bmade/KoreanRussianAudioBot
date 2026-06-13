# KoreanRussianAudioBot

Telegram listening-practice bot for Korean and Russian expressions.

The bot is designed for Russian speakers learning Korean, and it is also useful for Korean speakers learning Russian. Each audio file repeats one Korean-Russian expression pair at least 20 times, so students can learn by repeated listening instead of typing answers.

## Telegram Bot

- Username: `@KoreanRussianAudioBot`
- Free plan: 3 expressions per day
- Active plan: unlimited listening for manually activated users
- Daily Challenge: active users only

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=BotFather token
BUY_ME_A_COFFEE_URL=https://www.buymeacoffee.com/...
ACTIVE_CHAT_IDS=teacher_id,family_id,paid_user_id
FREE_DAILY_LIMIT=3
```

## Local Audio Workflow

Source MP3 files are stored outside the repo:

```text
G:\Codex\Korean_Russian_Practice_Audio\source.mp3
```

Run the sync script after adding or changing MP3 files:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\sync-audio.ps1
```

The script:

- Converts source MP3 files to OGG/Opus with metadata removed
- Saves public bot audio as `audio/public/exp_000001.ogg`
- Mirrors converted OGG files to `G:\Codex\Korean_Russian_Practice_Audio\public.ogg`
- Generates `content/expressions.json`
- Generates `content/audio_manifest.csv`

Original MP3 filenames are never sent to students.

## Validate Content

```bash
npm run validate
```

## Coolify

Use GitHub repo deployment with Docker Compose. This is a long-polling Telegram bot, so no public port or domain is required.

