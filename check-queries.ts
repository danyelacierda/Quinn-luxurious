import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envStr = fs.readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
envStr.split("\n").forEach(line => {
  if (line.trim() && !line.startsWith("#")) {
    const [key, ...rest] = line.split("=");
    env[key.trim()] = rest.join("=").trim();
  }
});

const supabase = createClient(
  env["NEXT_PUBLIC_SUPABASE_URL"],
  env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
);

async function check() {
  console.log("Checking reviews...");
  const { error: revErr } = await supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(1);
  if (revErr) console.error("reviews error:", revErr);
  else console.log("reviews ok");

  console.log("Checking promotions...");
  const { error: promErr } = await supabase.from("promotions").select("*").eq("is_active", true);
  if (promErr) console.error("promotions error:", promErr);
  else console.log("promotions ok");

  console.log("Checking services...");
  const { error: srvErr } = await supabase.from("services").select("*").eq("is_active", true).order("category");
  if (srvErr) console.error("services error:", srvErr);
  else console.log("services ok");

  console.log("Checking staff...");
  const { error: staffErr } = await supabase.from("staff").select("*").eq("is_active", true);
  if (staffErr) console.error("staff error:", staffErr);
  else console.log("staff ok");

  console.log("Checking gallery...");
  const { error: galErr } = await supabase.from("gallery").select("*").order("sort_order");
  if (galErr) console.error("gallery error:", galErr);
  else console.log("gallery ok");

  console.log("Checking appointments...");
  const { error: apptErr } = await supabase.from("appointments").select("*, services(name, duration_minutes, price), staff(full_name)");
  if (apptErr) console.error("appointments error:", apptErr);
  else console.log("appointments ok");

  console.log("Checking users...");
  const { error: usersErr } = await supabase.from("users").select("*").eq("role", "customer");
  if (usersErr) console.error("users error:", usersErr);
  else console.log("users ok");
}

check();
