const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function sync() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  
  // Create user Danielle
  await supabase.from('users').upsert({
    id: 'user_2mzz4Vb8N5oZ1bOQ5u3u3R3qF5b', // This might not be her clerk ID though!
    full_name: 'Danielle Acierda',
    email: 'danielle.acierda@urios.edu.ph',
    role: 'admin'
  });
  console.log("Synced");
}
sync();
