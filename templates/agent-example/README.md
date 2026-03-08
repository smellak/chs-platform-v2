# Aleph Agent Example

A ready-to-use template for building custom agents that integrate with the Aleph Platform. This example demonstrates three capabilities: greeting users, searching records, and creating new records.

## Prerequisites

- Node.js 20+
- A running Aleph Platform instance (for end-to-end testing)

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode (auto-reload on changes)
npm run dev

# Build for production
npm run build
npm start
```

The agent server starts on port 4000 by default. Set the `PORT` environment variable to change it (see `.env.example`).

## Project Structure

```
agent-example/
  src/
    index.ts        # Agent definition, handler, Express server
  .env.example      # Environment variable template
  Dockerfile        # Multi-stage production build
  package.json
  tsconfig.json
```

## Registering with Aleph

1. Start your agent so it is reachable from the Aleph server.
2. In the Aleph admin panel, navigate to **Settings > Agents**.
3. Add a new agent with the URL pointing to your agent (e.g., `http://localhost:4000`).
4. Aleph will fetch `GET /manifest` to discover the agent's capabilities.
5. Once registered, users can invoke the agent's capabilities through the Aleph chat interface.

## Endpoints

| Method | Path        | Description                                         |
|--------|-------------|-----------------------------------------------------|
| GET    | `/health`   | Health check; returns status and capability list    |
| GET    | `/manifest` | Agent manifest for Aleph capability discovery       |
| POST   | `/agent`    | Main handler; receives capability invocation from Aleph |

## X-Aleph Headers Reference

When Aleph forwards a request to your agent it includes the following headers so the agent knows who is making the request:

| Header                  | Description                                   | Example               |
|-------------------------|-----------------------------------------------|-----------------------|
| `X-CHS-User-Id`      | Unique identifier for the user                | `usr_abc123`          |
| `X-CHS-User-Name`    | Display name of the user                      | `Jane Doe`            |
| `X-CHS-User-Email`   | Email address of the user                     | `jane@example.com`    |
| `X-CHS-Role`         | User role in the platform                     | `super-admin`, `dept-admin`, `user` |
| `X-CHS-Access-Level` | Granular access level                         | `full`, `limited`     |
| `X-CHS-Org-Id`       | Organization identifier (optional)            | `org_xyz`             |
| `X-CHS-Dept`         | Department the user belongs to (optional)     | `Engineering`         |

The agent SDK parses these headers automatically and provides them as a typed `CHSUser` object inside the `AgentRequest`.

## Request Body Format

```json
{
  "capability": "saludar",
  "parameters": {
    "nombre": "Carlos",
    "idioma": "es"
  },
  "conversationContext": [
    { "role": "user", "content": "Greet Carlos in Spanish" }
  ]
}
```

## Response Format

```json
{
  "text": "Hola, Carlos! Bienvenido/a a Aleph Platform.",
  "data": {
    "nombre": "Carlos",
    "idioma": "es",
    "userId": "usr_abc123"
  }
}
```

If an error occurs the response includes an `error` field:

```json
{
  "text": "",
  "error": "Description of what went wrong"
}
```

## Capabilities in This Example

### `saludar` (read permission)

Greets a user by name. Supports Spanish (`es`), English (`en`), and French (`fr`).

**Parameters:**
- `nombre` (string, required) -- Name of the person to greet
- `idioma` (string, optional) -- Language code (`es`, `en`, `fr`); defaults to `es`

### `buscar_datos` (read permission)

Searches the in-memory record store by title or content.

**Parameters:**
- `consulta` (string, required) -- Search query
- `limite` (number, optional) -- Maximum results; defaults to 10

### `crear_registro` (write permission)

Creates a new record. Requires the user to have `write` permission (access level `full` or role `super-admin`).

**Parameters:**
- `titulo` (string, required) -- Title for the new record
- `contenido` (string, required) -- Body content
- `publicar` (boolean, optional) -- Publish immediately; defaults to `false`

## Building Your Own Agent

1. Copy this template directory.
2. Edit `src/index.ts`:
   - Define your own `AgentCapability` objects.
   - Implement your logic inside the `handleRequest` function.
3. Update `package.json` with your agent's name.
4. Register the agent with your Aleph instance.

## Docker

```bash
# Build the image
docker build -t my-aleph-agent .

# Run
docker run -p 4000:4000 my-aleph-agent
```

Note: The Dockerfile assumes the `@chs-platform/agent-sdk` package is available at `../../packages/agent-sdk` relative to the build context. When building with Docker, you may need to adjust the context or use a published version of the SDK.

## License

See the root [LICENSE](../../LICENSE) file.
