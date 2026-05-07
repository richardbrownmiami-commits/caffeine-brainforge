# brainforge

BrainForge AI App Builder — npm/pnpm package with CLI and API client.

## Install

```bash
npm install brainforge
pnpm add brainforge
```

## CLI

```bash
npx brainforge init
npx brainforge status
npx brainforge chat "Hello"
npx brainforge help
```

## API Client

```typescript
import { BrainForge } from 'brainforge';

const bf = new BrainForge({
  apiUrl: 'https://brainforge-api.richard-brown-miami.workers.dev',
  secret: 'your-secret',
});

const response = await bf.chat({ message: 'Build me a todo app' });
console.log(response.reply);
```

## Environment Variables

```
BRAINFORGE_API_URL=https://brainforge-api.richard-brown-miami.workers.dev
BRAINFORGE_SECRET=your-secret-key
BRAINFORGE_PROJECT_ID=default
```
