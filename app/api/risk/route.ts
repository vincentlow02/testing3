
import { NextResponse } from "next/server";
import { fetchRulesFromSheet } from "@/lib/rules";
import { SYSTEM_PROMPT } from "@/lib/prompt";

type ReqBody = {
    customer_message: string;
    candidate_reply: string | null; // null = draft mode, string = review mode
};

function detectReplyLanguage(text: string) {
    const t = text.trim();
    if (!t) return null;

    // Script-based detection for non-Latin languages.
    if (/[\u4E00-\u9FFF]/.test(t)) return "Chinese";
    if (/[\u3040-\u30FF]/.test(t)) return "Japanese";
    if (/[\uAC00-\uD7AF]/.test(t)) return "Korean";
    if (/[\u0400-\u04FF]/.test(t)) return "Russian";
    if (/[\u0600-\u06FF]/.test(t)) return "Arabic";
    if (/[\u0E00-\u0E7F]/.test(t)) return "Thai";

    // Heuristic for Malay vs English (both Latin).
    const malayMarkers = [
        "saya",
        "anda",
        "kami",
        "mohon",
        "sila",
        "terima kasih",
        "tidak",
        "boleh",
        "akan",
        "dengan",
        "untuk",
        "pembayaran",
        "pesanan",
    ];
    const lower = t.toLowerCase();
    let hits = 0;
    for (const w of malayMarkers) {
        if (lower.includes(w)) hits += 1;
    }
    if (hits >= 2) return "Malay";

    return "English";
}

function safeJsonParse(text: string) {
    // Gemini 有时会包一层 ```json ... ```，这里做个兜底
    const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();
    return JSON.parse(cleaned);
}

export async function POST(req: Request) {
    const body = (await req.json()) as ReqBody;
    const customer_message = (body.customer_message || "").trim();
    const candidate_reply = body.candidate_reply === null ? null : (body.candidate_reply || "").trim();

    if (!customer_message) {
        return NextResponse.json({ error: "customer_message is required" }, { status: 400 });
    }

    const rules = await fetchRulesFromSheet();

    // Beta：先把规则全部塞进去（5条很短）
    const ruleLines = rules.map((r) => `- [${r.rule_id}] (${r.channel}) ${r.rule_text}`);

    const reply_language_hint =
        candidate_reply && candidate_reply.trim() ? detectReplyLanguage(candidate_reply) : null;

    const userPayload = {
        customer_message,
        candidate_reply,
        reply_language_hint,
        rules: ruleLines,
        sops: [], // 你后面加 SOP Sheet 再塞
    };

    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "Missing GOOGLE_API_KEY" }, { status: 500 });
    }

    // Fallback Logic: Try a list of models in order
    const modelsToTry = [
        process.env.GEMINI_MODEL,    // User defined preference
        "gemini-2.5-flash-lite",     // User suggested: high freq, low cost
        "gemini-2.5-flash",          // Alternative 2.5
        "gemini-2.0-flash",          // Fast model
        "gemini-1.5-flash",          // Stable fallback
        "gemini-1.5-pro",            // Powerful fallback
    ].filter((m): m is string => !!m && m.trim() !== ""); // Filter valid strings

    // Dedup models
    const uniqueModels = [...new Set(modelsToTry)];

    let lastError = null;

    for (const model of uniqueModels) {
        console.log(`Trying model: ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                { text: `SYSTEM:\n${SYSTEM_PROMPT}` },
                                { text: `USER_PAYLOAD:\n${JSON.stringify(userPayload, null, 2)}` },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 800,
                    },
                }),
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.warn(`Model ${model} failed: ${resp.status} - ${errText}`);
                lastError = { status: resp.status, details: errText };
                continue; // Try next model
            }

            const data = await resp.json();
            const text =
                data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
                "";

            try {
                const json = safeJsonParse(text);
                // Inject metadata about which model was used (optional, helpful for debugging)
                return NextResponse.json({ ...json, _model_used: model });
            } catch {
                return NextResponse.json({ error: "Invalid JSON from model", raw: text, _model_used: model }, { status: 500 });
            }

        } catch (e) {
            console.warn(`Network error with model ${model}:`, e);
            lastError = { error: String(e) };
            continue;
        }
    }

    // If we get here, all models failed
    return NextResponse.json(
        { error: "All models failed", last_error: lastError },
        { status: 500 }
    );
}
