export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  });
}
