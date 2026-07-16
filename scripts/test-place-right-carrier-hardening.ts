import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

interface Finding {
  file: string
  detail: string
}

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function walk(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((entry) => {
    const absolute = join(root, dir, entry)
    const repoPath = relative(root, absolute).replace(/\\/g, '/')
    const stats = statSync(absolute)
    if (stats.isDirectory()) {
      return walk(repoPath)
    }
    return stats.isFile() && /\.(ts|tsx)$/.test(entry) ? [repoPath] : []
  })
}

const servicePath = 'src/app/services/arcApplicationService.ts'
const service = read(servicePath)

assert(
  /export type PlaceRightCarriedPlanBuildOptions = RunGeneratePlanOptions & \{\s*routeShapeContract: RouteShapeContract\s*\}/m.test(
    service,
  ),
  'runPlanBuild must expose carried Place-Right options with required routeShapeContract.',
)
assert(
  /export async function runPlanBuild\(\s*input: IntentInput,\s*options: PlaceRightCarriedPlanBuildOptions,\s*\): Promise<GeneratePlanResult>/m.test(
    service,
  ),
  'runPlanBuild must require PlaceRightCarriedPlanBuildOptions.',
)
assert(
  /export async function runPlanBuildWithLegacyPlaceRightFallback\(\s*input: IntentInput,\s*options\?: RunGeneratePlanOptions,\s*\): Promise<GeneratePlanResult> \{\s*return runGeneratePlan\(input, options\)\s*\}/m.test(
    service,
  ),
  'legacy Place-Right fallback must be isolated behind the explicit compat adapter.',
)

const app = read('src/App.tsx')
assert(
  /const startModeMatch = normalizedPathname\.match\(\^?/.test(app) === false
    ? false
    : /const startModeMatch = normalizedPathname\.match\(\s*\/\^\\\/start\\\/\(surprise\|curate\|build\)\\\/\?\$\/\s*\)/m.test(
        app,
      ) &&
        /page = <PublicConciergePage initialMode=\{startModeMatch\[1\] as ExperienceMode\} \/>/.test(
          app,
        ),
  '/start/* must route to PublicConciergePage.',
)
assert(
  /normalizedPathname === '\/archive'/.test(app) &&
    /page = <AppShell environment="archive" \/>/.test(app),
  'AppShell must remain archive-scoped for this carrier proof.',
)

const sourceFiles = [...walk('src/app'), ...walk('src/pages')].filter((file) => file !== servicePath)
const directRunPlanBuildImports: Finding[] = []

for (const file of sourceFiles) {
  const source = read(file)
  if (
    /import\s*\{[\s\S]*?\brunPlanBuild\b[\s\S]*?\}\s*from\s*['"][^'"]*arcApplicationService['"]/m.test(
      source,
    )
  ) {
    directRunPlanBuildImports.push({
      file,
      detail: 'imports runPlanBuild from arcApplicationService',
    })
  }
}

assert(
  directRunPlanBuildImports.length === 0,
  `Silent runPlanBuild imports remain: ${JSON.stringify(directRunPlanBuildImports)}`,
)

const explicitCompatFiles = [
  'src/app/AppShell.tsx',
  'src/app/services/curate/buildCuratePublicCardGateDiagnostics.ts',
  'src/app/services/curate/buildCurateScenarioCardGateDiagnostics.ts',
  'src/pages/DemoPage.tsx',
  'src/pages/SandboxConciergePage.tsx',
]

const compatRows = explicitCompatFiles.map((file) => {
  const source = read(file)
  const compatReferences = source.match(/\brunPlanBuildWithLegacyPlaceRightFallback\b/g)?.length ?? 0
  assert(compatReferences > 0, `${file} must use the explicit legacy Place-Right fallback adapter.`)
  return {
    file,
    compatReferences,
  }
})

console.log(
  JSON.stringify(
    {
      observer: 'place_right_carrier_hardening',
      summary: {
        strictCarrierRequired: true,
        explicitLegacyCompatAdapter: true,
        publicStartRouteUsesPublicConciergePage: true,
        appShellArchiveScoped: true,
        silentRunPlanBuildImports: directRunPlanBuildImports.length,
        providerCalls: 0,
      },
      compatRows,
    },
    null,
    2,
  ),
)
