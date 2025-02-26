import React from "react"
import findBaseDir from "../settings/findBaseDir.js"
import fs from "fs-extra"
import { ENV, BAKED_BASE_URL } from "../settings/serverSettings.js"
import { GOOGLE_FONTS_URL, POLYFILL_URL } from "./SiteConstants.js"
import type { Manifest } from "vite"
import { sortBy } from "@ourworldindata/utils"

const VITE_DEV_URL = process.env.VITE_DEV_URL ?? "http://localhost:8090"

// We ALWAYS load Google Fonts and polyfills.

const googleFontsStyles = (
    <link key="google-fonts" href={GOOGLE_FONTS_URL} rel="stylesheet" />
)

const polyfillScript = <script key="polyfill" src={POLYFILL_URL} />
const polyfillPreload = (
    <link
        key="polyfill-preload"
        rel="preload"
        href={POLYFILL_URL}
        as="script"
    />
)

interface Assets {
    forHeader: JSX.Element[]
    forFooter: JSX.Element[]
}

// in dev: we need to load several vite core scripts and plugins; other than that we only need to load the entry point, and vite will take care of the rest.
const devAssets = (entry: string, baseUrl: string): Assets => {
    return {
        forHeader: [googleFontsStyles, polyfillPreload],
        forFooter: [
            polyfillScript,
            <script
                key="vite-react-preamble" // https://vitejs.dev/guide/backend-integration.html
                type="module"
                dangerouslySetInnerHTML={{
                    __html: `import RefreshRuntime from '${baseUrl}/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true`,
                }}
            />,
            <script
                key="vite-plugin-checker"
                type="module"
                src={`${baseUrl}/@vite-plugin-checker-runtime-entry`}
            />,
            <script
                key="vite-client"
                type="module"
                src={`${baseUrl}/@vite/client`}
            />,
            <script key={entry} type="module" src={`${baseUrl}/${entry}`} />,
        ],
    }
}

// Goes through the manifest.json file that vite creates, finds all the assets that are required for the entry point,
// and creates the appropriate <link> and <script> tags for them.
export const createTagsForManifestEntry = (
    manifest: Manifest,
    entry: string,
    assetBaseUrl: string
): Assets => {
    const createTags = (entry: string): JSX.Element[] => {
        const manifestEntry =
            Object.values(manifest).find((e) => e.file === entry) ??
            manifest[entry]
        let assets = [] as JSX.Element[]

        if (!manifestEntry)
            throw new Error(`Could not find manifest entry for ${entry}`)

        const assetUrl = `${assetBaseUrl}${manifestEntry.file}`

        if (entry.endsWith(".css")) {
            assets = [
                ...assets,
                <link key={entry} rel="stylesheet" href={assetUrl} />,
            ]
        } else if (entry.match(/\.[cm]?(js|jsx|ts|tsx)$/)) {
            // explicitly reference the entry; preload it and its dependencies
            if (manifestEntry.isEntry) {
                assets = [
                    ...assets,
                    <script key={entry} type="module" src={assetUrl} />,
                ]
            }

            assets = [
                ...assets,
                <link
                    key={`${entry}-preload`}
                    rel="modulepreload" // see https://developer.chrome.com/blog/modulepreload/
                    href={assetUrl}
                />,
            ]
        }

        // we need to recurse into both the module imports and imported css files, and add tags for them as well
        // also, we need to take care of the order here, so the imported file is loaded before the importing file
        if (manifestEntry.css) {
            assets = [...manifestEntry.css.flatMap(createTags), ...assets]
        }
        if (manifestEntry.imports) {
            assets = [...manifestEntry.imports.flatMap(createTags), ...assets]
        }
        return assets
    }

    const assets = createTags(entry)
    return {
        forHeader: assets.filter((el) => el.type === "link"),
        forFooter: assets.filter((el) => el.type === "script"),
    }
}

// in prod: we need to make sure that we include <script> and <link> tags that are required for the entry point.
// this could be, for example: owid.mjs, common.mjs, owid.css, common.css. (plus Google Fonts and polyfills)
const prodAssets = (entry: string, baseUrl: string): Assets => {
    const baseDir = findBaseDir(__dirname)
    const manifestPath = `${baseDir}/dist/manifest.json`
    let manifest
    try {
        manifest = fs.readJSONSync(manifestPath) as Manifest
    } catch (err) {
        throw new Error(
            `Could not read build manifest ('${manifestPath}'), which is required for production.`,
            { cause: err }
        )
    }

    const assetBaseUrl = `${baseUrl}/`
    const assets = createTagsForManifestEntry(manifest, entry, assetBaseUrl)

    return {
        // sort for some kind of consistency: first modulepreload, then preload, then stylesheet
        forHeader: sortBy(
            [googleFontsStyles, polyfillPreload, ...assets.forHeader],
            "props.rel"
        ),
        forFooter: [polyfillScript, ...assets.forFooter],
    }
}

export const viteAssets = (entry: string) =>
    ENV === "production"
        ? prodAssets(entry, BAKED_BASE_URL)
        : devAssets(entry, VITE_DEV_URL)

export const generateEmbedSnippet = (baseUrl: string) => {
    const assets = prodAssets("site/owid.entry.ts", baseUrl)
    const serializedAssets = [...assets.forHeader, ...assets.forFooter].map(
        (el) => ({
            tag: el.type,
            props: el.props,
        })
    )

    const scriptCount = serializedAssets.filter(
        (asset) => asset.tag === "script"
    ).length

    return `
const assets = ${JSON.stringify(serializedAssets, undefined, 2)};
let loadedScripts = 0;

const onLoad = () => {
    loadedScripts++;
    if (loadedScripts === ${scriptCount}) {
        window.MultiEmbedderSingleton.embedAll();
    }
}

for (const asset of assets) {
    const el = document.createElement(asset.tag);
    for (const [key, value] of Object.entries(asset.props)) {
        el.setAttribute(key, value);
    }
    if (asset.tag === "script")
        el.onload = onLoad;
    document.head.appendChild(el);
}`
}
