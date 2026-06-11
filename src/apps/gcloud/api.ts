// Side-effectful fetch layer. Each call takes an injectable `fetchImpl` so error
// mapping is unit-testable with a mocked fetch (mirrors health/runner.ts). All
// HTTP/CORS errors are normalised to an ApiError carrying an ApiErrorInfo.
import {
  mapApiError,
  parseLogEntries,
  parseRunServices,
  parseSqlInstances,
  parseTimeSeries,
  type ApiErrorInfo,
  type LogRow,
  type MetricSeries,
  type RunService,
  type SqlInstance,
} from './logic';

export class ApiError extends Error {
  info: ApiErrorInfo;
  constructor(info: ApiErrorInfo) {
    super(info.message);
    this.name = 'ApiError';
    this.info = info;
  }
}

async function request(
  method: 'GET' | 'POST',
  url: string,
  token: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      mode: 'cors',
    });
  } catch {
    // A thrown fetch (not an HTTP error status) is almost always CORS or offline.
    throw new ApiError({
      kind: 'cors',
      message:
        'The browser blocked the request (CORS or network failure). Confirm the API supports browser requests and that this origin is allow-listed on your OAuth client.',
    });
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(mapApiError(res.status, errBody));
  }
  return res.json().catch(() => ({}));
}

export async function listRunServices(
  projectId: string,
  region: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RunService[]> {
  const url = `https://run.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(region)}/services`;
  return parseRunServices(await request('GET', url, token, undefined, fetchImpl));
}

export async function listSqlInstances(
  projectId: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SqlInstance[]> {
  const url = `https://sqladmin.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/instances`;
  return parseSqlInstances(await request('GET', url, token, undefined, fetchImpl));
}

export async function fetchTimeSeries(
  projectId: string,
  params: URLSearchParams,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MetricSeries[]> {
  const url = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries?${params.toString()}`;
  return parseTimeSeries(await request('GET', url, token, undefined, fetchImpl));
}

export async function fetchLogs(
  body: unknown,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LogRow[]> {
  const url = 'https://logging.googleapis.com/v2/entries:list';
  return parseLogEntries(await request('POST', url, token, body, fetchImpl));
}
