import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = resolve(root, ".output/server")
const migrations = resolve(output, "migrations")
const wranglerPath = resolve(output, "wrangler.json")

await mkdir(migrations, { recursive: true })
await cp(resolve(root, "server/databases/migrations"), migrations, { recursive: true })

const wrangler = JSON.parse(await readFile(wranglerPath, "utf8"))
wrangler.d1_databases = wrangler.d1_databases?.map(database =>
  database.binding === "DB"
    ? { ...database, migrations_dir: "migrations" }
    : database,
)
await writeFile(wranglerPath, `${JSON.stringify(wrangler, null, 2)}\n`)
