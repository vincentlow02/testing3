
"use client";
import { useState } from "react";

export default function TestPage() {
    const [customer, setCustomer] = useState("");
    const [reply, setReply] = useState("");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    async function call(mode: "draft" | "review") {
        setLoading(true);
        setResult(null);
        try {
            const payload = {
                customer_message: customer,
                candidate_reply: mode === "draft" ? null : reply,
            };
            const res = await fetch("/api/risk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            setResult(json);

            // draft 模式：把 draft_reply 自动塞进编辑框
            if (mode === "draft" && json?.draft_reply) setReply(json.draft_reply);
        } finally {
            setLoading(false);
        }
    }

    const safe = result?.safe_to_send === true;

    return (
        <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
            <h2>Risk Reply Test</h2>

            <label>Customer message</label>
            <textarea
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                rows={4}
                style={{ width: "100%", padding: 10, marginBottom: 12 }}
                placeholder="Type a customer complaint/question..."
            />

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button disabled={loading || !customer.trim()} onClick={() => call("draft")}>
                    {loading ? "Running..." : "Generate Draft"}
                </button>
                <button disabled={loading || !reply.trim()} onClick={() => call("review")}>
                    {loading ? "Running..." : "Review Edited Reply"}
                </button>

                <button disabled={!safe} title={!safe ? "Must pass AI review before sending" : ""}>
                    Send (locked until safe)
                </button>
            </div>

            <label>Reply (editable)</label>
            <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={6}
                style={{ width: "100%", padding: 10, marginBottom: 16 }}
                placeholder="AI draft will appear here. Edit it, then click Review."
            />

            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
                <strong>Status:</strong>{" "}
                {result?.safe_to_send === true ? "✅ SAFE" : result ? "❌ NOT SAFE / UNKNOWN" : "—"}
                <div style={{ marginTop: 6 }}>
                    <strong>Badge:</strong> {result?.review_badge ?? "—"}
                </div>
                {result?.suggested_fix && (
                    <div style={{ marginTop: 6 }}>
                        <strong>Suggested fix:</strong> {result.suggested_fix}
                    </div>
                )}
            </div>

            <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, overflowX: "auto" }}>
                {result ? JSON.stringify(result, null, 2) : "No result yet."}
            </pre>
        </div>
    );
}
