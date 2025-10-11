// src/utils/http.ts
import axios from 'axios';

export const http = axios.create({
  baseURL: 'https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/main/src/assets',
  timeout: 10000,
  headers: { Accept: 'application/json' },
});

export async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const { data } = await http.get<T>(path, { signal });
  return data;
}
