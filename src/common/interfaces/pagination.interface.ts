export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface SuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}
