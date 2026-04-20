#!/usr/bin/env bash
# Supabase MCP(HTTP) + Cursor Agent CLI 안내
# 실행: bash scripts/supabase-mcp-cursor-cli.sh
# 또는: npm run mcp:supabase

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Supabase MCP (Streamable HTTP)"
echo " URL: https://mcp.supabase.com/mcp"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "【1】프로젝트 MCP 설정 (이미 있으면 생략)"
echo "    $ROOT/.cursor/mcp.json"
echo ""
echo "【2】특정 프로젝트만 쓰려면 (~/.cursor/mcp.json 권장)"
echo "    url 끝에 쿼리 추가: ?project_ref=대시보드의프로젝트ref"
echo "    예: https://mcp.supabase.com/mcp?project_ref=abcdefghijkl"
echo ""
echo "【3】Cursor Agent CLI (PATH에 있을 때)"
echo "    서버 식별자는 mcp.json 의 키 이름 → supabase"
echo ""
echo "    agent mcp list"
echo "    agent mcp login supabase"
echo "    agent mcp list-tools supabase"
echo ""
echo "    ※ agent 가 없으면: Cursor 앱 → Settings → Tools & MCP 에서"
echo "       동일 URL로 추가 후 브라우저 OAuth 로그인"
echo ""
echo "【4】CI/토큰 방식 (브라우저 없을 때) — Supabase 문서 참고"
echo "    url: https://mcp.supabase.com/mcp?project_ref=\$SUPABASE_PROJECT_REF"
echo "    headers.Authorization: Bearer \$SUPABASE_ACCESS_TOKEN"
echo "    (Cursor mcp.json 의 headers 에 넣을 수 있음)"
echo ""
