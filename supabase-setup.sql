-- 在 Supabase 控制台的 SQL Editor 中运行此脚本

-- 1. 创建商品表
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  contact TEXT DEFAULT '',
  colors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 开启 RLS 并设置公开读写策略
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_public_select" ON products FOR SELECT USING (true);
CREATE POLICY "allow_public_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_public_update" ON products FOR UPDATE USING (true);
CREATE POLICY "allow_public_delete" ON products FOR DELETE USING (true);
