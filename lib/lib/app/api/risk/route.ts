import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const candidateReply = body?.candidate_reply ?? null;

  // ✅ Draft mode: 永远返回 draft_reply
  if (candidateReply === null) {
    return NextResponse.json({
      risk_level: "medium",
      risk_reasons: ["refund-related"],
      missing_info: ["Order ID", "Delivery date"],
      draft_reply: "DRAFT_OK ✅ Please provide your order ID and delivery date. We will verify eligibility first, then assist with the next steps.",
      safe_to_send: false,
      review_badge: "Draft only",
      suggested_fix: null,
    });
  }

  // Review mode
  const text = String(candidateReply).toLowerCase();
  const overpromise = text.includes("immediately") || text.includes("guarantee") || text.includes("100%");

  if (overpromise) {
    return NextResponse.json({
      risk_level: "high",
      risk_reasons: ["Overpromise detected"],
      missing_info: ["Order ID", "Delivery date"],
      draft_reply: null,
      safe_to_send: false,
      review_badge: "Overpromise",
      suggested_fix: "Avoid guarantees. Ask for order details and confirm eligibility first.",
    });
  }

  return NextResponse.json({
    risk_level: "low",
    risk_reasons: [],
    missing_info: [],
    draft_reply: null,
    safe_to_send: true,
    review_badge: "Safe to send",
    suggested_fix: null,
  });
}
