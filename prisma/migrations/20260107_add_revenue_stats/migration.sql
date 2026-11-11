-- 1. Tạo Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS revenue_stats AS
SELECT 
    DATE(t."createdAt") AS date,
    COUNT(t.id)::int AS tickets_sold,
    COALESCE(SUM(t."paidAmount"), 0) AS total_revenue
FROM "Tickets" t
WHERE t.status = 'CONFIRMED'
GROUP BY DATE(t."createdAt");

-- 2. Tạo Unique Index (Bắt buộc để dùng REFRESH CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS revenue_stats_date_idx ON revenue_stats (date);