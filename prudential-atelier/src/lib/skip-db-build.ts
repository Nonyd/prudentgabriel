export function isSkipDbBuild(): boolean {
  return process.env.SKIP_DB_BUILD === "1";
}
