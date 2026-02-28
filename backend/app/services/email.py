import httpx

from app.config import settings

RESEND_URL = "https://api.resend.com/emails"


async def send_weekly_report_email(
    to_email: str,
    display_name: str,
    report: dict,
    app_url: str = "https://finameter.com",
):
    """Send a weekly report summary email via Resend."""
    if not settings.resend_api_key:
        print("[email] resend_api_key not set, skipping email")
        return

    stats = report.get("stats", {})
    sector_summaries = report.get("sector_summaries", [])
    report_id = report.get("id", "")

    # Build sector teasers
    sector_lines = ""
    for s in sector_summaries:
        teaser = (s.get("summary") or "")[:120]
        if len(s.get("summary", "")) > 120:
            teaser += "..."
        sector_lines += f"<tr><td style='padding:8px 0;border-bottom:1px solid #2d2d2d'><strong style='color:#fff'>{s['sector_name']}</strong><br><span style='color:#9ca3af;font-size:13px'>{teaser}</span></td></tr>"

    html = f"""
    <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111;color:#e5e7eb;padding:32px;border-radius:12px">
      <h1 style="color:#fff;font-size:22px;margin:0 0 4px">Your Weekly Report</h1>
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px">Hi {display_name}, here's your week in review.</p>

      <div style="display:flex;gap:12px;margin-bottom:24px">
        <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:12px;text-align:center">
          <div style="color:#2dd4bf;font-size:20px;font-weight:700">{stats.get('accuracy_pct', 0)}%</div>
          <div style="color:#6b7280;font-size:11px">Accuracy</div>
        </div>
        <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:12px;text-align:center">
          <div style="color:#facc15;font-size:20px;font-weight:700">+{stats.get('xp_earned', 0)}</div>
          <div style="color:#6b7280;font-size:11px">XP Earned</div>
        </div>
        <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:12px;text-align:center">
          <div style="color:#60a5fa;font-size:20px;font-weight:700">{stats.get('quizzes_taken', 0) + stats.get('daily_quizzes_taken', 0)}</div>
          <div style="color:#6b7280;font-size:11px">Quizzes</div>
        </div>
      </div>

      <h2 style="color:#fff;font-size:16px;margin:0 0 12px">Sector Highlights</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">{sector_lines}</table>

      <a href="{app_url}/profile#weekly-reports" style="display:block;text-align:center;background:#14b8a6;color:#fff;text-decoration:none;padding:12px;border-radius:8px;font-weight:600;font-size:14px">
        View Full Report
      </a>

      <p style="color:#4b5563;font-size:11px;text-align:center;margin:20px 0 0">FinaMeter — Learn finance, one article at a time.</p>
    </div>
    """

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(
                RESEND_URL,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "FinaMeter <reports@finameter.com>",
                    "to": to_email,
                    "subject": f"Your Weekly Report — {stats.get('accuracy_pct', 0)}% accuracy this week",
                    "html": html,
                },
            )
    except Exception as e:
        print(f"[email] failed to send weekly report email: {e}")
