/** Prevent browsers from serving stale appearance JSON after uploads/saves. */
export const PUBLIC_GET_FETCH_INIT = {
  method: 'GET',
  headers: {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
  cache: 'no-store',
}
