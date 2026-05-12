/**
 * Tiny helper shared by the spec forms.
 *
 * Converts a list of dotted-path strings (matching `ZodIssue.path`)
 * into a `(field) => boolean` predicate so each `<Input>` can light
 * up its `aria-invalid` ring without the parent having to thread
 * field names around.
 */

export function invalidFields(paths?: readonly string[]): (field: string) => boolean {
  if (!paths || paths.length === 0) return () => false
  const set = new Set(paths)
  return (field: string) => set.has(field)
}

/** Convert zod issues into the dotted-path list this helper expects. */
export function zodIssuesToPaths(
  issues: readonly { path: ReadonlyArray<PropertyKey> }[] | undefined,
): string[] {
  if (!issues) return []
  return issues.map((i) => i.path.map((p) => String(p)).join('.'))
}
