import { Response } from 'express';

export function successResponse(res: Response, data: unknown, statusCode = 200) {
  return res.status(statusCode).json({ ok: true, data });
}

export function paginatedResponse(
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  limit: number
) {
  return res.status(200).json({
    ok: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
