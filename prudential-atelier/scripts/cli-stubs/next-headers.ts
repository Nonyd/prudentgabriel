/** next/headers for command-line bundles: there is no request, so asking for one is a bug. */
function noRequest(): never {
  throw new Error("next/headers is not available outside a request (command-line bundle)");
}
export function headers(): never {
  return noRequest();
}
export function cookies(): never {
  return noRequest();
}
