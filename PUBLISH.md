# Publishing TAPE to npm

## Pre-flight

- [ ] Node.js 18+ installed
- [ ] npm account ([npmjs.com/signup](https://www.npmjs.com/signup))
- [ ] GitHub Desktop installed

---

## Step 1: Check the name

```bash
npm view tapeui
```

If the name is taken, open `package.json` and change `"name"` to something
else like `@yourusername/tapeui` or `tape-ui`.

---

## Step 2: GitHub Desktop

1. Open GitHub Desktop
2. **File → Add Local Repository** → pick the `tapeui` folder
3. It'll say "not a git repository" — click **Create a Repository**
4. Name: `tapeui`, click **Create Repository**
5. All files appear as changes. Write a commit message: `initial commit`
6. Click **Commit to main**
7. Click **Publish repository** at the top
8. Uncheck "Keep this code private" if you want it public
9. Click **Publish Repository**

---

## Step 3: Open terminal

In GitHub Desktop: **Repository → Open in Terminal** (Mac) or **Open in Command Prompt** (Windows).

Or just navigate there manually:

```bash
cd path/to/tapeui
```

---

## Step 4: Install + build + test

```bash
npm install
npm run build
npm test
```

You should see:
- `dist/index.js` (CJS, ~23 KB)
- `dist/index.mjs` (ESM, ~22 KB)
- `dist/index.d.ts` (types, ~6 KB)
- 62 tests passing

---

## Step 5: Log in to npm

```bash
npm login
```

Browser opens for authentication. Follow the prompts.

Verify you're logged in:

```bash
npm whoami
```

---

## Step 6: Publish

```bash
npm publish
```

If you're using a scoped name like `@yourusername/tapeui`:

```bash
npm publish --access public
```

The `prepublishOnly` script runs the build automatically before publishing.

---

## Step 7: Verify

```bash
npm view tapeui
```

Visit [npmjs.com/package/tapeui](https://www.npmjs.com/package/tapeui).

Test installation:

```bash
mkdir /tmp/tape-test && cd /tmp/tape-test
npm init -y && npm install tapeui react react-dom
node -e "const t = require('tapeui'); console.log(Object.keys(t))"
```

You should see: `Tape, useTape, Recorder, mergeComments, buildReport, ...`

---

## Updating

1. Make your changes
2. In GitHub Desktop: commit and push
3. In terminal:

```bash
npm version patch   # 0.1.0 → 0.1.1
npm run build
npm test
npm publish
```

4. In GitHub Desktop: push (it'll push the new version tag too)

### Version bumps

| Command | When to use |
|---------|-------------|
| `npm version patch` | Bug fixes (0.1.0 → 0.1.1) |
| `npm version minor` | New features (0.1.0 → 0.2.0) |
| `npm version major` | Breaking changes (0.1.0 → 1.0.0) |

---

## Quick reference

| Command | What it does |
|---------|-------------|
| `npm run build` | Compile TS → dist/ (ESM + CJS + types) |
| `npm run dev` | Watch mode for development |
| `npm test` | Run 62 tests against built output |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm publish` | Publish to npm |
| `npm pack --dry-run` | Preview what gets published |

---

## What gets published

```
tapeui-0.1.0.tgz (15.5 KB)
├── dist/index.js       CJS bundle
├── dist/index.mjs      ESM bundle
├── dist/index.d.ts     TypeScript declarations
├── dist/index.d.mts    TypeScript declarations (ESM)
├── README.md
├── LICENSE
└── package.json
```

Source files, tests, docs, and config files are excluded via `.npmignore`.
