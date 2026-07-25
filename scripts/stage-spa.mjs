import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const publicDir = resolve(root, ".output/public")
const precomputedUrl = pathToFileURL(resolve(root, ".output/server/_chunks/precomputed.mjs"))
const { default: precomputed } = await import(`${precomputedUrl.href}?${Date.now()}`)
const resources = Object.values(precomputed.dependencies)
  .flatMap(dependency => Object.values(dependency.scripts || {}))
const entry = resources.find(resource => resource.isEntry)

if (!entry) throw new Error("Nuxt client entry was not generated.")

const { id: buildId } = JSON.parse(
  await readFile(resolve(publicDir, "_nuxt/builds/latest.json"), "utf8"),
)
const styles = (entry.css || [])
  .map(file => `<link rel="stylesheet" href="/_nuxt/${file}">`)
  .join("")
const config = {
  app: {
    baseURL: "/",
    buildAssetsDir: "/_nuxt/",
    buildId,
    cdnURL: "",
  },
  public: {},
}
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Calories</title>${styles}</head><body><div id="__nuxt"></div><div id="teleports"></div><script type="application/json" id="__NUXT_DATA__" data-ssr="false">[{"serverRendered":1},false]</script><script>window.__NUXT__={};window.__NUXT__.config=${JSON.stringify(config)}</script><script type="module" src="/_nuxt/${entry.file}"></script></body></html>`

await writeFile(resolve(publicDir, "index.html"), html)
