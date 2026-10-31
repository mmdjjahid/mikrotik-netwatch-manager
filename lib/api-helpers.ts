import { NextResponse } from 'next/server';
import { getDb } from './db';
import { getSetting } from './settings';

export interface QueryOptions {
  search?: string;
  searchFields?: string[];
  sort?: string;
  order?: 'asc' | 'desc' | 'ASC' | 'DESC';
  page?: number;
  pageSize?: number | null;
  whereClause?: string;
  whereParams?: unknown[];
}

export function jsonSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseQueryParams(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'id';
  const orderRaw = url.searchParams.get('order')?.toLowerCase();
  const order: 'asc' | 'desc' = orderRaw === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSizeParam = url.searchParams.get('pageSize');
  const pageSize = pageSizeParam ? Math.max(1, Math.min(500, parseInt(pageSizeParam, 10))) : null;

  return { search, sort, order, page, pageSize, searchParams: url.searchParams };
}

export function queryList<T = Record<string, unknown>>(
  table: string,
  options: QueryOptions = {}
) {
  const db = getDb();
  const defaultPageSize = getSetting<number>('ui.page_size', 25);
  const pageSize = options.pageSize || defaultPageSize;
  const page = options.page || 1;
  const offset = (page - 1) * pageSize;

  const validSort = /^[a-zA-Z0-9_]+$/.test(options.sort || '') ? options.sort : 'id';
  const dir = options.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.whereClause) {
    conditions.push(options.whereClause);
    if (options.whereParams) {
      params.push(...options.whereParams);
    }
  }

  if (options.search && options.searchFields && options.searchFields.length > 0) {
    const searchTerms = options.searchFields.map((f) => `${f} LIKE ?`).join(' OR ');
    conditions.push(`(${searchTerms})`);
    for (let i = 0; i < options.searchFields.length; i++) {
      params.push(`%${options.search}%`);
    }
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM ${table} ${whereSql}`).get(...(params as [string | number])) as { total: number };
  const total = countRow ? countRow.total : 0;

  // Get paginated rows
  const rows = db
    .prepare(`SELECT * FROM ${table} ${whereSql} ORDER BY ${validSort} ${dir} LIMIT ? OFFSET ?`)
    .all(...(params as [string | number]), pageSize, offset) as unknown as T[];

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

export function exportCsv(rows: Record<string, unknown>[], columns: string[]): string {
  if (!rows || rows.length === 0) return '';
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col] === undefined || row[col] === null ? '' : String(row[col]);
        if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(',')
  );
  return `${header}\n${lines.join('\n')}`;
}

export function recordActivityLog(user: string, action: string, detail = '', ipAddress = '') {
  try {
    const db = getDb();
    db.prepare('INSERT INTO logs (user, action, detail, ip_address) VALUES (?, ?, ?, ?)').run(
      user || 'system',
      action,
      detail,
      ipAddress
    );
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

