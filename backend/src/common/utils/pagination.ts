import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants';

/**
 * Parse pagination query params with safe defaults
 */
export function parsePagination(query: { page?: string; limit?: string }): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Parse simple single-value pagination (for list endpoints)
 */
export function parsePageParam(value?: string): number {
  return Math.max(1, parseInt(value, 10) || DEFAULT_PAGE);
}
