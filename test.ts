import { getReviews } from "./lib/supabase/queries";

async function run() {
  const reviews = await getReviews();
  console.log("Reviews:", reviews);
}
run();
