# RT Azure Copilot Studio — Direct Line broker

This repository contains a small **Node.js broker** that talks to a **Microsoft Copilot Studio** (Power Virtual Agents) bot through **Direct Line v3**, plus:

- a browser **test UI** (served by the same server),
- a simple **`/api/chat`** JSON API used by that UI, and
- an **OpenAI-compatible** **`/v1/chat/completions`** surface for tools and clients that expect the OpenAI HTTP shape.

The HTTP sequence matches the included **Postman collection** (`Co-Pilot Studio Flow.postman_collection.json`): obtain a Direct Line token from Power Platform → start a Direct Line conversation → post a user activity → poll for bot replies.

---

## Prerequisites

- A **Copilot Studio** bot with the **Direct Line token** endpoint available in your Power Platform environment (the same URL you use in Postman “Get Direct Line Token”).
- Either:
  - **Docker** + **Docker Compose** v2 (recommended to run on other machines), or
  - **Node.js 18 or newer** (uses the built-in `fetch` API) if you run from source.
- For optional background start/stop scripts on the host: **bash** (macOS/Linux, or Git Bash / WSL on Windows).

---

## Repository layout

| Path | Description |
|------|-------------|
| `broker/` | Express app: Direct Line client, APIs, static web UI |
| `broker/public/` | Test chat UI (`index.html`, `app.js`, `styles.css`) |
| `broker/lib/` | Direct Line logic, sessions, OpenAI-compatible routes |
| `broker/scripts/` | Optional background `broker:start` / `broker:stop` helpers |
| [`broker/Dockerfile`](broker/Dockerfile) | OCI image definition (Node 20); build = packaged broker |
| [`docker-compose.yml`](docker-compose.yml) | Compose stack from repo root |
| **Pre-built Docker image** | [`twgcriot/copilot-studio-broker:latest`](https://hub.docker.com/r/twgcriot/copilot-studio-broker) on Docker Hub |
| `Co-Pilot Studio Flow.postman_collection.json` | Reference collection for the same flow in Postman |

Secrets and local artifacts are **not** committed (see `.gitignore`): `broker/.env`, `node_modules`, `.broker.pid`, `.broker.log`.

---

## Configuration

### 1. Install dependencies

```bash
cd broker
npm install
```

### 2. Create `broker/.env`

Copy the example file and edit values as needed:

```bash
cp .env.example .env
```

### 3. Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COPILOT_DIRECTLINE_TOKEN_URL` | **Yes** | — | Full **GET** URL to your bot’s Direct Line token endpoint in Power Platform, including `api-version` (same as the “Get Direct Line Token” request in the Postman collection). Example path shape: `.../powervirtualagents/botsbyschema/<bot>/directline/token?api-version=2022-03-01-preview`. |
| `PORT` | No | `8080` | HTTP port for the broker. |
| `DIRECT_LINE_ROOT` | No | `https://directline.botframework.com/v3/directline` | Direct Line API root (rarely need to change). |
| `USER_FROM_ID` | No | `user1` | `from.id` on outbound user activities to Direct Line. |
| `POLL_INTERVAL_MS` | No | `1000` | Delay between polls when waiting for a bot message. |
| `POLL_TIMEOUT_MS` | No | `45000` | Maximum time to wait for a bot reply after you send a user message. |
| `INITIAL_DELAY_MS` | No | `0` | Extra delay (ms) before the first poll after posting an activity. |
| `OPENAI_COMPAT_MODEL_ID` | No | `copilot-studio` | Model id returned by `GET /v1/models` and used when clients omit `model`. |

The broker loads `.env` from the **`broker/`** directory (via `dotenv` when you run `server.js` from that folder). When you use **Docker Compose**, variables are injected from the same `broker/.env` file on the host (they are **not** baked into the image).

---

## Docker (recommended for other machines)

The container image uses **Node 20** and listens on **8080 inside the container**. [Docker Compose](https://docs.docker.com/compose/) maps that to a port on your computer (by default **8080** on the host). Official overview: [Get Docker](https://docs.docker.com/get-docker/).

### Install Docker

Pick the guide that matches your OS, install the current **Docker Desktop** or **Docker Engine**, then **start the Docker daemon** (on Windows and macOS this means launching **Docker Desktop** and waiting until it reports “running”).

| OS | What to install | Official install guide |
|----|-----------------|------------------------|
| **Windows 10/11** | **Docker Desktop** (WSL 2 backend recommended) | [Install Docker Desktop on Windows](https://docs.docker.com/desktop/install/windows-install/) |
| **macOS** (Intel or Apple silicon) | **Docker Desktop** | [Install Docker Desktop on Mac](https://docs.docker.com/desktop/install/mac-install/) |
| **Linux** (Ubuntu, Debian, Fedora, etc.) | **Docker Engine** + **Docker Compose plugin** | [Install Docker Engine](https://docs.docker.com/engine/install/) — follow the post-install steps for your distro so your user can run `docker` without `sudo` if you prefer ([Linux](https://docs.docker.com/engine/install/linux-postinstall/)) |

On **Linux**, install the **`docker-compose-plugin`** package (or equivalent) so the command **`docker compose`** (with a space) is available; older standalone **`docker-compose`** binaries are not required for this project.

### Verify Docker is working

In a new terminal:

```bash
docker version
docker compose version
```

You should see a **Client** and **Server** section from `docker version` (server missing usually means the daemon is not running). `docker compose version` should report **Compose v2** (e.g. `v2.x.x`). If `docker compose` is not found, finish the Compose plugin install for your platform.

### Pre-built image on Docker Hub

| | |
|--|--|
| **Image** | `twgcriot/copilot-studio-broker:latest` |
| **Registry** | [Docker Hub — `twgcriot/copilot-studio-broker`](https://hub.docker.com/r/twgcriot/copilot-studio-broker) |

```bash
docker pull twgcriot/copilot-studio-broker:latest
```

For your own Docker Hub repository, use **`YOUR_DOCKERHUB_USERNAME/copilot-studio-broker:latest`**.

---

### Run the container (`docker run`, default port **8080**)

These examples use **`--rm`**, **`PORT=8080`** inside the container, and **`-p 8080:8080`** on the host. Open **http://localhost:8080/** when mapping **`8080:8080`**. Change the **first** number in **`-p`** for a different host port (e.g. **`-p 9090:8080`**).

When using **`--env-file`**, your file must include **`COPILOT_DIRECTLINE_TOKEN_URL`** (see [Configure environment variables](#configure-environment-variables)). Paths are relative to your shell’s **current directory**.

#### 1. Inline environment (quick test)

The token may appear in **shell history**—prefer **`--env-file`** for daily use.

**Local image** `copilot-studio-broker:latest` (after `docker build`):

```bash
docker run --rm \
  -e COPILOT_DIRECTLINE_TOKEN_URL="https://...your-token-url..." \
  -e PORT=8080 \
  -p 8080:8080 \
  copilot-studio-broker:latest
```

You can run the same command with **`twgcriot/copilot-studio-broker:latest`** (or **`YOUR_DOCKERHUB_USERNAME/copilot-studio-broker:latest`**) as the image on the last line—no local build required.

#### 2. Local build + env file

From the **repository root**:

```bash
docker build -t copilot-studio-broker:latest ./broker
docker run --rm \
  --env-file broker/.env \
  -e PORT=8080 \
  -p 8080:8080 \
  copilot-studio-broker:latest
```

#### 3. Pull from Docker Hub + env file

```bash
docker pull twgcriot/copilot-studio-broker:latest
docker run --rm \
  --env-file broker/.env \
  -e PORT=8080 \
  -p 8080:8080 \
  twgcriot/copilot-studio-broker:latest
```

Use **`YOUR_DOCKERHUB_USERNAME/copilot-studio-broker:latest`** if you push your own image. If **`.env` is not at `broker/.env`**, use **`--env-file /absolute/path/to/.env`**.

Configuration is applied only at **run** time; it is **not** baked into the image.

### Get the repository

Clone and enter the project when you want to **build the image from source** or use the repo’s [`docker-compose.yml`](docker-compose.yml) with `build:` (adjust the URL if you use a fork):

```bash
git clone https://github.com/twgcriot/RT_Azure_Co-PilotStudio.git
cd RT_Azure_Co-PilotStudio
```

### Configure environment variables

From the **repository root**, create `broker/.env` from the template and edit it:

```bash
cp broker/.env.example broker/.env
```

Set at least **`COPILOT_DIRECTLINE_TOKEN_URL`** (see the [Environment variables](#3-environment-variables) table). Other variables in `broker/.env` are passed into the container.

**Compose and `PORT`:** [`docker-compose.yml`](docker-compose.yml) sets **`PORT=8080`** inside the container so the app matches the published port. To use a different **host** port (e.g. **9090** on your machine while the container still uses 8080 internally), set **`HOST_PORT`** when starting Compose:

```bash
HOST_PORT=9090 docker compose up --build
```

Default host port is **8080** if `HOST_PORT` is omitted.

### Run with Docker Compose

From the **repository root** (same folder as `docker-compose.yml`):

**Foreground** (logs in the terminal; stop with **Ctrl+C**):

```bash
docker compose up --build
```

**Detached** (runs in the background):

```bash
docker compose up --build -d
```

View logs when detached:

```bash
docker compose logs -f broker
```

**Stop** the stack:

```bash
docker compose down
```

**Open the app:** [http://localhost:8080/](http://localhost:8080/) — or `http://localhost:<HOST_PORT>/` if you set **`HOST_PORT`**.

**Health check** (optional):

```bash
curl -s http://localhost:8080/api/health
```

Use the same host port you mapped (e.g. replace `8080` with `9090` if `HOST_PORT=9090`).

### Build the Docker image (package the broker)

The runnable **artifact** is a container image produced from [`broker/Dockerfile`](broker/Dockerfile). Nothing else is required on the target machine except Docker (or another OCI runtime) and your **`broker/.env`** at run time.

**From the repository root** (recommended tag includes a version you choose):

```bash
docker build -t copilot-studio-broker:1.0.0 -t copilot-studio-broker:latest ./broker
```

**From the `broker/` directory** (same image):

```bash
cd broker
npm run docker:build
```

That script tags **`copilot-studio-broker:latest`** only. List local images: `docker images copilot-studio-broker`.

**Export a tarball** (USB / air-gapped / attach to a ticket):

```bash
docker save -o copilot-studio-broker-1.0.0.tar copilot-studio-broker:1.0.0
```

**Import elsewhere:**

```bash
docker load -i copilot-studio-broker-1.0.0.tar
docker run --rm --env-file /path/to/.env -e PORT=8080 -p 8080:8080 copilot-studio-broker:1.0.0
```

Secrets stay in **`--env-file`** / environment; they are **not** stored inside the image layers.

### Run with Docker only (no Compose)

Use **Run the container (`docker run`, default port 8080)** (section above) for the standard **`docker build` / `docker pull` + `docker run`** patterns.

Optional: add **`--name copilot-studio-broker`** to **`docker run`** to name the container. Remove **`--rm`** if you need to inspect a stopped container. Stop a foreground run with **Ctrl+C**.

### Publishing the image (optional)

Images must be tagged with **`registry/namespace/image:tag`**. Your **local** build is usually named `copilot-studio-broker:latest`; retag before push.

#### Docker Hub

1. Create a free account at [hub.docker.com](https://hub.docker.com/) and create a **repository** (e.g. `copilot-studio-broker`) under your **username** or **organization** (names must be lowercase; use hyphens if needed).
2. Log in from the machine that has the image:
   ```bash
   docker login
   ```
   Enter your **Docker Hub username** and password (for 2FA accounts, use an **access token** as the password: [Docker Hub → Account Settings → Security → New Access Token](https://hub.docker.com/settings/security)).
3. Tag the image so the first path segment is your **Docker Hub username or org**:
   ```bash
   docker tag copilot-studio-broker:latest <dockerhub-username>/copilot-studio-broker:1.0.0
   docker tag copilot-studio-broker:latest <dockerhub-username>/copilot-studio-broker:latest
   ```
4. Push:
   ```bash
   docker push <dockerhub-username>/copilot-studio-broker:1.0.0
   docker push <dockerhub-username>/copilot-studio-broker:latest
   ```

**Pull and run elsewhere:**

```bash
docker pull <dockerhub-username>/copilot-studio-broker:latest
docker run --rm --env-file /path/to/.env -e PORT=8080 -p 8080:8080 <dockerhub-username>/copilot-studio-broker:latest
```

**Publish `twgcriot/copilot-studio-broker` (maintainers):** On [Docker Hub](https://hub.docker.com/), ensure the **`twgcriot/copilot-studio-broker`** repository exists (create it under org **twgcriot** if needed). Log in with an account that has **push** rights to that namespace:

```bash
docker login
docker build -t twgcriot/copilot-studio-broker:latest -t twgcriot/copilot-studio-broker:1.0.0 ./broker
docker push twgcriot/copilot-studio-broker:latest
docker push twgcriot/copilot-studio-broker:1.0.0
```

If **`push access denied`** or **`insufficient_scope`**: run **`docker logout`** then **`docker login`** again (use a [Docker access token](https://hub.docker.com/settings/security) if 2FA is on), and confirm your user is in the **twgcriot** organization with **write** permissions—or push under your **personal** Docker Hub username instead.

#### GitHub Container Registry (GHCR)

```bash
docker tag copilot-studio-broker ghcr.io/<org-or-user>/copilot-studio-broker:1.0.0
docker push ghcr.io/<org-or-user>/copilot-studio-broker:1.0.0
```

(Authenticate with `docker login ghcr.io` using a GitHub PAT with `write:packages`.)

#### General note

On another machine, use **`docker run`** or Compose with **`image: ...`** instead of **`build:`**, and still pass **`COPILOT_DIRECTLINE_TOKEN_URL`** at run time via **`--env-file`** or your platform’s secret mechanism—not inside the image.

---

## Running the broker (from source)

All commands below assume your current directory is **`broker/`**.

### Foreground (attached terminal)

```bash
npm start
```

The process listens on `http://localhost:<PORT>` (default **8080**). Stop with **Ctrl+C**.

### Development (auto-restart on file changes)

```bash
npm run dev
```

Uses `node --watch server.js`.

### Background (macOS/Linux bash)

Writes the process id to **`broker/.broker.pid`** and append-only logs to **`broker/.broker.log`**:

```bash
npm run broker:start
```

Stop:

```bash
npm run broker:stop
```

If there is no pid file, `broker:stop` attempts to stop whatever is **listening on `PORT`** from `.env` (or **8080**). Ensure that port is not shared with another important service.

---

## Using the test web UI

1. Start the broker (`docker compose up` from repo root, or `npm start` / `npm run broker:start` from `broker/`).
2. Open **http://localhost:8080/** in a browser (use your **HOST_PORT** if you changed it in Compose).
3. Send messages; the UI calls **`POST /api/chat`** and shows user vs bot lines.
4. **Clear chat** clears the transcript and drops the browser session id (next send starts a new Copilot conversation on the server).

---

## REST APIs

Base URL: `http://localhost:<PORT>` (replace host/port if you deploy elsewhere).

### Health

```http
GET /api/health
```

Response example:

```json
{ "ok": true, "configured": true }
```

`configured` is `false` when `COPILOT_DIRECTLINE_TOKEN_URL` is missing.

### Chat (used by the web UI)

```http
POST /api/chat
Content-Type: application/json

{
  "text": "Hello",
  "sessionId": "<optional UUID from prior response>"
}
```

Response (success):

```json
{
  "sessionId": "<uuid>",
  "userText": "Hello",
  "replies": [
    { "role": "bot", "text": "...", "timestamp": "...", "id": "..." }
  ],
  "timedOut": false
}
```

- Omit **`sessionId`** on the first message of a conversation; the response returns a new **`sessionId`** for follow-ups.
- If you send an unknown **`sessionId`**, the server returns **404** (e.g. after a broker restart with in-memory sessions cleared).

### OpenAI-compatible surface

Use a client base URL of **`http://localhost:<PORT>/v1`** (many SDKs append `/chat/completions`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/models` | Lists one model (id = `OPENAI_COMPAT_MODEL_ID` or `copilot-studio`). |
| `GET` | `/v1/models/:modelId` | Returns metadata for that model, or 404. |
| `POST` | `/v1/chat/completions` | Non-streaming chat completion. |

**Chat completions** body (typical):

```json
{
  "model": "copilot-studio",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "user": "my-stable-session-id"
}
```

- The broker sends the **last `user` message** in `messages` to Copilot (earlier entries are not replayed to Direct Line).
- **`user`**: optional. If set, it acts as a **stable session key** for multi-turn (same idea as `/api/chat`’s `sessionId`). If omitted, the broker creates a session and returns **`X-Broker-Session-Id`** on the response; you can send that value as **`user`** on the next request.
- **`stream: true`** is **not** supported (returns **400**).

Example `curl`:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"copilot-studio","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Postman collection

Import **`Co-Pilot Studio Flow.postman_collection.json`** into Postman to exercise the raw Power Platform + Direct Line calls. The **same token URL** should be placed in **`COPILOT_DIRECTLINE_TOKEN_URL`** in `broker/.env` for the broker to work against the same bot.

---

## Security and operations notes

- **Do not commit `broker/.env`**; it can encode environment-specific URLs. Use **`broker/.env.example`** as a template only. Do **not** copy real `.env` content into **Docker image layers**; pass configuration at **`docker run`** / Compose **`env_file`** time only.
- Session and token data are kept **in memory**; restarting the broker clears sessions. Clients must start a new conversation or use new session ids.
- The broker is aimed at **local or trusted network** use. Exposing it on the internet without authentication would let anyone send messages through your Copilot bot configuration.
- **HTTPS** and **auth** are not built in; put the broker behind a reverse proxy or API gateway if you need that in production.

---

## Troubleshooting

| Symptom | Things to check |
|--------|-------------------|
| `configured: false` in `/api/health` | Set `COPILOT_DIRECTLINE_TOKEN_URL` in `broker/.env` and restart. |
| `503` on chat routes | Same as above. |
| `404` on `/api/chat` for `sessionId` | Session expired after restart; omit `sessionId` or clear the UI / use a new `user` in OpenAI calls. |
| No bot text, `timedOut: true` | Increase `POLL_TIMEOUT_MS` or check bot latency; confirm the bot responds in Postman for the same bot. |
| Port already in use | Change `PORT` in `broker/.env` (source run), set **`HOST_PORT`** for Compose, or change **`-p`** with plain Docker; or run `npm run broker:stop` on the host. |
| `docker compose` fails on `env_file` | Create **`broker/.env`** first (`cp broker/.env.example broker/.env` and edit). |
| OpenAI client cannot connect | Base URL should include **`/v1`** if the SDK expects the OpenAI path prefix (e.g. `http://localhost:8080/v1`). |

---

## License

Use and modification are at your discretion unless the repository owner adds a formal license file.
