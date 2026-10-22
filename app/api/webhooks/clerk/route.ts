import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SIGNING_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as unknown as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  // Handle the event
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, first_name, last_name, email_addresses, phone_numbers } = evt.data;

    const email = email_addresses?.[0]?.email_address;
    const phone = phone_numbers?.[0]?.phone_number || null;
    const full_name = `${first_name || ''} ${last_name || ''}`.trim() || email?.split('@')[0] || 'Unknown';

    if (!email) {
      return new Response('No email address provided', { status: 400 });
    }

    const supabase = createAdminClient();

    // We do NOT include `role` here so that `upsert` uses the DB default ('customer') 
    // on insert, and avoids overwriting an existing role (e.g. 'admin') on update.
    const { error } = await supabase
      .from('users')
      .upsert({
        id: id,
        email: email,
        full_name: full_name,
        phone: phone,
      }, { onConflict: 'id' });
      
    if (error) {
      console.error('Error syncing user to Supabase:', error);
      return new Response('Error syncing user', { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    if (id) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting user from Supabase:', error);
        return new Response('Error deleting user', { status: 500 });
      }
    }
  }

  return new Response('', { status: 200 });
}
