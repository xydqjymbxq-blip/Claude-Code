# Russian Language Learning App

A Progressive Web App (PWA) for personal Russian language learning, optimized for iPhone use. Transforms passive vocabulary into active, spoken fluency through a systematic **5-phase activation system**.

## Features

- **5-Phase Vocabulary System**: Recognition → Pronunciation → Simple Sentences → Complex Use → Real-Time Conversation
- **Smart Assessment**: Tests 150 sample words to statistically project proficiency across 8,000+ words
- **Spaced Repetition**: Intelligent review scheduling per phase
- **AI-Powered Feedback**: Claude evaluates pronunciation, grammar, and fluency
- **Speech Recognition**: Web Speech API (free) or OpenAI Whisper (accurate)
- **PWA**: Installable on iPhone home screen, works offline
- **Daily Sessions**: Smart session builder with configurable duration

## Tech Stack

- **Frontend**: React + Tailwind CSS + PWA
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **AI**: Anthropic Claude API (evaluation & conversation)
- **Speech**: Web Speech API / OpenAI Whisper
- **TTS**: Browser Speech Synthesis / ElevenLabs

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Anthropic API key

### Setup

1. **Clone and install**
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

2. **Configure backend**
```bash
cd backend
cp .env.example .env
# Edit .env with your API keys and database URL
```

3. **Initialize database**
```bash
cd backend
npm run migrate
```

4. **Start development servers**
```bash
# Backend (port 3001)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm start
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT tokens (use long random string) |
| `ANTHROPIC_API_KEY` | Yes | From console.anthropic.com |
| `OPENAI_API_KEY` | No | For Whisper speech recognition |
| `ELEVENLABS_API_KEY` | No | For higher quality TTS |
| `FRONTEND_URL` | Yes | Frontend URL for CORS |

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npx vercel
# Set REACT_APP_API_URL to your Railway backend URL
```

### Backend (Railway)
- Connect GitHub repo to Railway
- Add PostgreSQL plugin
- Set environment variables
- Railway auto-deploys on push

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login
- `GET /api/auth/profile` — Get profile
- `PUT /api/auth/profile` — Update profile

### Vocabulary
- `POST /api/vocabulary/import` — Import CSV/JSON flashcards
- `GET /api/vocabulary` — List words (with filter/search)
- `GET /api/vocabulary/phase/:phase` — Words due for phase
- `PUT /api/vocabulary/:id` — Update word
- `DELETE /api/vocabulary/:id` — Delete word

### Practice
- `GET /api/practice/session` — Get daily session
- `POST /api/practice/attempt` — Submit practice result
- `POST /api/practice/evaluate/pronunciation` — Evaluate pronunciation
- `POST /api/practice/evaluate/sentence` — Evaluate sentence
- `POST /api/practice/evaluate/conversation` — Evaluate/continue conversation

### Progress
- `GET /api/progress/dashboard` — Dashboard stats
- `GET /api/progress/stats` — Detailed stats & trends
- `GET /api/progress/streak` — Streak info

### Assessment
- `POST /api/assessment/start` — Start initial assessment
- `POST /api/assessment/answer` — Submit assessment answer
- `POST /api/assessment/complete` — Finalize & project phases

## CSV Import Format

```csv
необходимый,necessary
привет,hello
спасибо,thank you
работа,work
```

Or JSON:
```json
[
  {"russian_word": "необходимый", "english_definition": "necessary"},
  {"russian_word": "привет", "english_definition": "hello"}
]
```

## Monthly Cost Estimate

| Option | Cost |
|--------|------|
| Web Speech API + Browser TTS | ~$5/mo |
| Whisper + Browser TTS | ~$10/mo |
| Whisper + ElevenLabs | ~$20/mo |

## Phase System

| Phase | Name | Goal | Advancement |
|-------|------|------|-------------|
| 1 | Recognition | See & hear the word | Seen 3-5 times |
| 2 | Pronunciation | Say it accurately | 80%+ on 2 attempts |
| 3 | Simple Sentences | Use in simple sentences | 2 successful sentences |
| 4 | Complex Use | Natural conversation | 2 conversation successes |
| 5 | Real-Time | Automatic under pressure | Used naturally in live convo |
