## webserver
Backend APIs for ACOW.

### Setup
Install `pnpm`
```bash
npm i -g pnpm
```
Install dependencies
```bash
pnpm i
```
Copy `.env.example` to `.env` and populate it
- `DISCORD_CLIENT_*`: Obtain yours from [Discord Developer Portal](https://discord.com/developers/applications)
- `DISCORD_SERVER_ID`: The ID of the server whose members are allowed to login
- `JWT_PRIVATE_KEY_PATH`: `openssl genrsa -out private.pem 4096`
- `JWT_PUBLIC_KEY_PATH`: `openssl rsa -in private.pem -pubout -outform PEM -out public.pem`
- `ORIGIN`: The URL of this deployment
- `MYSQL`: MySQL/MariaDB connection string `mysql://<username>:<password>@<host>:<port>/<database>`
Install database schema
```bash
pnpm db:update
```
### Building
```bash
pnpm build
```

### Developing
Rebuild to restart the server
```bash
pnpm dev
```