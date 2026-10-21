import type { SeedFolder } from "../types";
import { AUTH_SERVICE } from "./auth-service";

// auth-service as a folder that isn't a project yet: no .lpm.yml, so lpm
// detects what to run from the Go module and docker-compose.yml instead.
const { [".lpm.yml"]: _config, ...files } = AUTH_SERVICE.files;

export const AUTH_SERVICE_FOLDER: SeedFolder = {
  name: AUTH_SERVICE.name,
  files,
  services: [
    AUTH_SERVICE.services[0],
    {
      name: "compose",
      cmd: "docker compose up",
      log: [
        { text: "$ docker compose up", color: "green", at: 50 },
        { text: "[+] Running 2/2", color: "muted", at: 500 },
        { text: " ✔ Container auth-service-postgres-1  Started", color: "green", at: 900 },
        { text: " ✔ Container auth-service-redis-1     Started", color: "green", at: 1000 },
        { text: "postgres-1  | database system is ready to accept connections", color: "muted", at: 1400 },
      ],
    },
  ],
  actions: AUTH_SERVICE.actions,
  git: AUTH_SERVICE.git,
  reply: AUTH_SERVICE.reply,
};
