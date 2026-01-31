export type RuleRow = {
    rule_id: string;
    channel: string;
    topic: string;
    rule_type: string;
    rule_text: string;
    risk_level: string;
    required_info?: string;
    example_flag?: string;
};

function parseCsvLine(line: string): string[] {
    // 够用的轻量 CSV 解析（支持双引号）
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"' && inQuotes && next === '"') {
            cur += '"';
            i++;
            continue;
        }
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === "," && !inQuotes) {
            out.push(cur.trim());
            cur = "";
            continue;
        }
        cur += ch;
    }
    out.push(cur.trim());
    return out;
}

export async function fetchRulesFromSheet(): Promise<RuleRow[]> {
    const url = process.env.SHEET_RULES_CSV_URL;
    if (!url) throw new Error("Missing SHEET_RULES_CSV_URL");

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch rules CSV: ${res.status}`);

    const csv = await res.text();
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string) => headers.indexOf(name.toLowerCase());

    const rows: RuleRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const get = (key: string) => cols[idx(key)] ?? "";

        const rule_id = get("rule_id");
        const rule_text = get("rule_text");
        if (!rule_id || !rule_text) continue;

        rows.push({
            rule_id,
            channel: get("channel"),
            topic: get("topic"),
            rule_type: get("rule_type"),
            rule_text,
            risk_level: get("risk_level"),
            required_info: get("required_info"),
            example_flag: get("example_flag"),
        });
    }
    return rows;
}
