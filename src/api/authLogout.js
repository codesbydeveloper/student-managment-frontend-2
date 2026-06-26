import { API_BASE_URL } from '../utils/constants'

export async function logoutRequest(authToken) {
  const headers = {
    Accept: '*/*',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers,
    })
  } catch {

  }
}
