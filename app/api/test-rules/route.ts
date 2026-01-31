
import { fetchRulesFromSheet } from "@/lib/rules";

export async function GET() {
    const rules = await fetchRulesFromSheet();

    console.log("=== RULES CHECK ===");
    console.log("count:", rules.length);
    console.log("first row:", rules[0]);
    console.log("headers check:", Object.keys(rules[0] || {}));

    return Response.json({
        count: rules.length,
        sample: rules[0],
    });
}
